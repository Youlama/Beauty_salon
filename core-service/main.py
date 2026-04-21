"""
CORE-SERVICE — Основной бизнес-сервис
Порт: 8002 | Маршрут через Gateway: /api/core/

Отвечает за:
  - Каталог услуг (CRUD, архивация)
  - Мастера (карточки, расписание, портфолио)
  - Записи (бронирование, отмена, перенос)
  - Отзывы (создание, модерация)
  - Расписание мастеров
"""
import os
from datetime import date, time
from typing import Optional, List

import databases
import sqlalchemy
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from minio import Minio
from minio.error import S3Error
from pydantic import BaseModel
import io, uuid

# ── Конфигурация ──────────────────────────────────────────────────
DATABASE_URL  = os.getenv("DATABASE_URL", "postgresql://belle:belle_secret@localhost:5432/belle_db")
SECRET_KEY    = os.getenv("SECRET_KEY", "dev-secret")
ALGORITHM     = os.getenv("ALGORITHM", "HS256")
MINIO_EP      = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_AK      = os.getenv("MINIO_ACCESS_KEY", "belle_minio")
MINIO_SK      = os.getenv("MINIO_SECRET_KEY", "belle_minio_secret")
MINIO_BUCKET  = os.getenv("MINIO_BUCKET", "belle-photos")

database  = databases.Database(DATABASE_URL)
metadata  = sqlalchemy.MetaData()
oauth2    = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

minio_client = Minio(MINIO_EP, access_key=MINIO_AK, secret_key=MINIO_SK, secure=False)

# ── SQLAlchemy таблицы (только читаем через raw SQL для гибкости) ─

# ── Auth helper ───────────────────────────────────────────────────
async def get_current_user(token: Optional[str] = Depends(oauth2)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"user_id": int(payload["sub"]), "role": payload["role"]}
    except JWTError:
        return None

async def require_auth(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Требуется авторизация")
    return user

async def require_admin(user=Depends(require_auth)):
    if user["role"] != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Только для администратора")
    return user

async def require_master_or_admin(user=Depends(require_auth)):
    if user["role"] not in ("master", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Только для мастера или администратора")
    return user

# ── Pydantic схемы ────────────────────────────────────────────────
class ServiceCreate(BaseModel):
    name:     str
    category: str
    duration: int
    price:    float
    icon:     str = "✂️"

class ServiceUpdate(BaseModel):
    name:     Optional[str]
    price:    Optional[float]
    duration: Optional[int]
    archived: Optional[bool]

class AppointmentCreate(BaseModel):
    service_id: int
    master_id:  int
    date:       str    # YYYY-MM-DD
    time_slot:  str    # HH:MM

class AppointmentReschedule(BaseModel):
    date:      str
    time_slot: str

class ReviewCreate(BaseModel):
    appointment_id: int
    rating:         int
    text:           str

class ReviewModerate(BaseModel):
    status:      str   # approved | rejected
    admin_reply: Optional[str] = None

class ScheduleSet(BaseModel):
    day_of_week: int   # 1-7
    start_time:  str
    end_time:    str

# ── FastAPI ───────────────────────────────────────────────────────
app = FastAPI(title="Core Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await database.connect()
    # Создать bucket MinIO если не существует
    try:
        if not minio_client.bucket_exists(MINIO_BUCKET):
            minio_client.make_bucket(MINIO_BUCKET)
    except Exception:
        pass

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "core"}

# ════════════════════════════════════════════════════════════════════
# УСЛУГИ
# ════════════════════════════════════════════════════════════════════
@app.get("/services")
async def list_services(category: Optional[str] = None, include_archived: bool = False):
    q = "SELECT * FROM services WHERE 1=1"
    params = {}
    if not include_archived:
        q += " AND archived = false"
    if category:
        q += " AND category = :cat"
        params["cat"] = category
    rows = await database.fetch_all(q, params)
    return [dict(r) for r in rows]

@app.get("/services/{service_id}")
async def get_service(service_id: int):
    row = await database.fetch_one("SELECT * FROM services WHERE id = :id", {"id": service_id})
    if not row:
        raise HTTPException(404, "Услуга не найдена")
    masters = await database.fetch_all(
        """SELECT m.id, u.name, m.rating, m.specialties
           FROM master_services ms
           JOIN masters m ON m.id = ms.master_id
           JOIN users u ON u.id = m.user_id
           WHERE ms.service_id = :sid""", {"sid": service_id}
    )
    return {**dict(row), "masters": [dict(m) for m in masters]}

@app.post("/services", status_code=201)
async def create_service(data: ServiceCreate, user=Depends(require_admin)):
    sid = await database.execute(
        "INSERT INTO services (name, category, duration, price, icon) VALUES (:n,:c,:d,:p,:i) RETURNING id",
        {"n": data.name, "c": data.category, "d": data.duration, "p": data.price, "i": data.icon}
    )
    return {"id": sid, **data.model_dump()}

@app.patch("/services/{service_id}")
async def update_service(service_id: int, data: ServiceUpdate, user=Depends(require_admin)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Нет полей для обновления")
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    await database.execute(
        f"UPDATE services SET {set_clause} WHERE id = :id",
        {**updates, "id": service_id}
    )
    return {"ok": True}

# ════════════════════════════════════════════════════════════════════
# МАСТЕРА
# ════════════════════════════════════════════════════════════════════
@app.get("/masters")
async def list_masters():
    rows = await database.fetch_all(
        """SELECT m.id, u.name, u.email, m.bio, m.specialties, m.rating
           FROM masters m JOIN users u ON u.id = m.user_id"""
    )
    result = []
    for r in rows:
        photos = await database.fetch_all(
            "SELECT * FROM portfolio_photos WHERE master_id = :mid ORDER BY created_at DESC LIMIT 3",
            {"mid": r["id"]}
        )
        reviews = await database.fetch_all(
            """SELECT rv.rating, rv.text, u.name AS author_name, rv.created_at
               FROM reviews rv JOIN users u ON u.id = rv.author_id
               WHERE rv.master_id = :mid AND rv.status = 'approved'
               ORDER BY rv.created_at DESC LIMIT 3""",
            {"mid": r["id"]}
        )
        result.append({**dict(r), "portfolio": [dict(p) for p in photos], "reviews": [dict(rv) for rv in reviews]})
    return result

@app.get("/masters/{master_id}")
async def get_master(master_id: int):
    r = await database.fetch_one(
        "SELECT m.id, u.name, u.email, m.bio, m.specialties, m.rating FROM masters m JOIN users u ON u.id=m.user_id WHERE m.id=:id",
        {"id": master_id}
    )
    if not r:
        raise HTTPException(404, "Мастер не найден")
    services = await database.fetch_all(
        """SELECT s.id, s.name, s.category, s.duration, s.price, s.icon,
                  COALESCE(ms.price_override, s.price) as effective_price
           FROM master_services ms JOIN services s ON s.id = ms.service_id
           WHERE ms.master_id = :mid""", {"mid": master_id}
    )
    photos = await database.fetch_all(
        "SELECT * FROM portfolio_photos WHERE master_id=:mid ORDER BY created_at DESC",
        {"mid": master_id}
    )
    reviews = await database.fetch_all(
        """SELECT rv.rating, rv.text, u.name AS author_name, rv.created_at, s.name AS service_name
           FROM reviews rv
           JOIN users u ON u.id=rv.author_id
           JOIN services s ON s.id=rv.service_id
           WHERE rv.master_id=:mid AND rv.status='approved' ORDER BY rv.created_at DESC""",
        {"mid": master_id}
    )
    schedule = await database.fetch_all(
        "SELECT day_of_week, start_time, end_time FROM master_schedule WHERE master_id=:mid",
        {"mid": master_id}
    )
    return {
        **dict(r),
        "services":  [dict(s) for s in services],
        "portfolio": [dict(p) for p in photos],
        "reviews":   [dict(rv) for rv in reviews],
        "schedule":  [dict(sc) for sc in schedule],
    }

# ════════════════════════════════════════════════════════════════════
# РАСПИСАНИЕ
# ════════════════════════════════════════════════════════════════════
@app.get("/schedule")
async def get_schedule(date: str):
    """Расписание всех мастеров на указанную дату."""
    masters = await database.fetch_all(
        "SELECT m.id, u.name FROM masters m JOIN users u ON u.id=m.user_id"
    )
    result = []
    for m in masters:
        booked = await database.fetch_all(
            """SELECT time_slot::text FROM appointments
               WHERE master_id=:mid AND date=:d AND status NOT IN ('cancelled')""",
            {"mid": m["id"], "d": date}
        )
        booked_times = {r["time_slot"][:5] for r in booked}
        result.append({
            "master_id": m["id"],
            "master_name": m["name"],
            "booked_slots": list(booked_times),
        })
    return result

@app.put("/masters/{master_id}/schedule", status_code=200)
async def set_master_schedule(master_id: int, data: ScheduleSet, user=Depends(require_master_or_admin)):
    await database.execute(
        """INSERT INTO master_schedule (master_id, day_of_week, start_time, end_time)
           VALUES (:mid, :dow, :st, :et)
           ON CONFLICT (master_id, day_of_week)
           DO UPDATE SET start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time""",
        {"mid": master_id, "dow": data.day_of_week, "st": data.start_time, "et": data.end_time}
    )
    return {"ok": True}

# ════════════════════════════════════════════════════════════════════
# ПОРТФОЛИО
# ════════════════════════════════════════════════════════════════════
@app.post("/portfolio/upload")
async def upload_portfolio(
    service_id: int,
    file: UploadFile = File(...),
    user=Depends(require_master_or_admin)
):
    # Получаем master_id по user_id
    master = await database.fetch_one(
        "SELECT id FROM masters WHERE user_id=:uid", {"uid": user["user_id"]}
    )
    if not master and user["role"] != "admin":
        raise HTTPException(403, "Профиль мастера не найден")

    master_id = master["id"] if master else None
    ext = file.filename.split(".")[-1]
    object_name = f"portfolio/{master_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()

    try:
        minio_client.put_object(
            MINIO_BUCKET, object_name,
            io.BytesIO(data), len(data),
            content_type=file.content_type
        )
    except S3Error as e:
        raise HTTPException(500, f"Ошибка загрузки: {e}")

    photo_url = f"http://localhost:9000/{MINIO_BUCKET}/{object_name}"
    photo_id = await database.execute(
        "INSERT INTO portfolio_photos (master_id, service_id, photo_url) VALUES (:mid,:sid,:url) RETURNING id",
        {"mid": master_id, "sid": service_id, "url": photo_url}
    )
    return {"id": photo_id, "photo_url": photo_url}

@app.get("/gallery")
async def get_gallery(master_id: Optional[int] = None, service_id: Optional[int] = None):
    q = """SELECT pp.id, pp.photo_url, pp.created_at,
                  u.name AS master_name, s.name AS service_name, s.category
           FROM portfolio_photos pp
           JOIN masters m ON m.id=pp.master_id
           JOIN users u ON u.id=m.user_id
           LEFT JOIN services s ON s.id=pp.service_id
           WHERE 1=1"""
    params = {}
    if master_id:
        q += " AND pp.master_id=:mid"; params["mid"] = master_id
    if service_id:
        q += " AND pp.service_id=:sid"; params["sid"] = service_id
    q += " ORDER BY pp.created_at DESC"
    rows = await database.fetch_all(q, params)
    return [dict(r) for r in rows]

# ════════════════════════════════════════════════════════════════════
# ЗАПИСИ
# ════════════════════════════════════════════════════════════════════
@app.get("/appointments")
async def list_appointments(user=Depends(require_auth)):
    if user["role"] == "client":
        q = """SELECT a.*, u.name AS client_name, s.name AS service_name, s.icon AS service_icon,
                      mu.name AS master_name
               FROM appointments a
               JOIN users u ON u.id=a.client_id
               JOIN services s ON s.id=a.service_id
               JOIN masters m ON m.id=a.master_id
               JOIN users mu ON mu.id=m.user_id
               WHERE a.client_id=:uid ORDER BY a.date DESC, a.time_slot"""
        rows = await database.fetch_all(q, {"uid": user["user_id"]})
    elif user["role"] == "master":
        master = await database.fetch_one("SELECT id FROM masters WHERE user_id=:uid", {"uid": user["user_id"]})
        if not master:
            return []
        q = """SELECT a.*, u.name AS client_name, s.name AS service_name, s.icon AS service_icon,
                      mu.name AS master_name
               FROM appointments a
               JOIN users u ON u.id=a.client_id
               JOIN services s ON s.id=a.service_id
               JOIN masters m ON m.id=a.master_id
               JOIN users mu ON mu.id=m.user_id
               WHERE a.master_id=:mid ORDER BY a.date, a.time_slot"""
        rows = await database.fetch_all(q, {"mid": master["id"]})
    else:  # admin
        q = """SELECT a.*, u.name AS client_name, s.name AS service_name, s.icon AS service_icon,
                      mu.name AS master_name
               FROM appointments a
               JOIN users u ON u.id=a.client_id
               JOIN services s ON s.id=a.service_id
               JOIN masters m ON m.id=a.master_id
               JOIN users mu ON mu.id=m.user_id
               ORDER BY a.date DESC, a.time_slot"""
        rows = await database.fetch_all(q)
    return [dict(r) for r in rows]

@app.post("/appointments", status_code=201)
async def create_appointment(data: AppointmentCreate, user=Depends(require_auth)):
    # Проверка двойного бронирования
    conflict = await database.fetch_one(
        """SELECT id FROM appointments
           WHERE master_id=:mid AND date=:d AND time_slot=:t AND status NOT IN ('cancelled')""",
        {"mid": data.master_id, "d": data.date, "t": data.time_slot}
    )
    if conflict:
        raise HTTPException(409, "Это время у мастера уже занято")

    # Цена услуги
    price_row = await database.fetch_one(
        """SELECT COALESCE(ms.price_override, s.price) AS price
           FROM services s
           LEFT JOIN master_services ms ON ms.service_id=s.id AND ms.master_id=:mid
           WHERE s.id=:sid""",
        {"mid": data.master_id, "sid": data.service_id}
    )
    price = float(price_row["price"]) if price_row else 0

    appt_id = await database.execute(
        """INSERT INTO appointments (client_id, service_id, master_id, date, time_slot, total_price)
           VALUES (:cid, :sid, :mid, :d, :t, :p) RETURNING id""",
        {"cid": user["user_id"], "sid": data.service_id, "mid": data.master_id,
         "d": data.date, "t": data.time_slot, "p": price}
    )
    return {"id": appt_id, "status": "pending", "total_price": price}

@app.patch("/appointments/{appt_id}/status")
async def update_status(appt_id: int, status: str, user=Depends(require_auth)):
    appt = await database.fetch_one("SELECT * FROM appointments WHERE id=:id", {"id": appt_id})
    if not appt:
        raise HTTPException(404, "Запись не найдена")
    if user["role"] == "client" and appt["client_id"] != user["user_id"]:
        raise HTTPException(403, "Нет доступа")
    if user["role"] == "client" and status != "cancelled":
        raise HTTPException(403, "Клиент может только отменить запись")
    if status not in ("pending","confirmed","completed","cancelled"):
        raise HTTPException(400, "Недопустимый статус")
    await database.execute("UPDATE appointments SET status=:s WHERE id=:id", {"s": status, "id": appt_id})
    return {"ok": True}

@app.patch("/appointments/{appt_id}/reschedule")
async def reschedule(appt_id: int, data: AppointmentReschedule, user=Depends(require_auth)):
    appt = await database.fetch_one("SELECT * FROM appointments WHERE id=:id", {"id": appt_id})
    if not appt:
        raise HTTPException(404, "Запись не найдена")
    if user["role"] == "client" and appt["client_id"] != user["user_id"]:
        raise HTTPException(403, "Нет доступа")
    conflict = await database.fetch_one(
        "SELECT id FROM appointments WHERE master_id=:mid AND date=:d AND time_slot=:t AND status NOT IN ('cancelled') AND id!=:id",
        {"mid": appt["master_id"], "d": data.date, "t": data.time_slot, "id": appt_id}
    )
    if conflict:
        raise HTTPException(409, "Выбранное время уже занято")
    await database.execute(
        "UPDATE appointments SET date=:d, time_slot=:t WHERE id=:id",
        {"d": data.date, "t": data.time_slot, "id": appt_id}
    )
    return {"ok": True}

# ════════════════════════════════════════════════════════════════════
# ОТЗЫВЫ
# ════════════════════════════════════════════════════════════════════
@app.get("/reviews")
async def list_reviews(master_id: Optional[int] = None, status_filter: Optional[str] = None):
    q = """SELECT rv.*, u.name AS author_name, s.name AS service_name, mu.name AS master_name
           FROM reviews rv
           JOIN users u ON u.id=rv.author_id
           JOIN services s ON s.id=rv.service_id
           JOIN masters m ON m.id=rv.master_id
           JOIN users mu ON mu.id=m.user_id
           WHERE 1=1"""
    params = {}
    if master_id:
        q += " AND rv.master_id=:mid"; params["mid"] = master_id
    if status_filter:
        q += " AND rv.status=:st"; params["st"] = status_filter
    else:
        q += " AND rv.status='approved'"
    q += " ORDER BY rv.created_at DESC"
    rows = await database.fetch_all(q, params)
    return [dict(r) for r in rows]

@app.post("/reviews", status_code=201)
async def create_review(data: ReviewCreate, user=Depends(require_auth)):
    # Проверяем что запись принадлежит клиенту и завершена
    appt = await database.fetch_one(
        "SELECT * FROM appointments WHERE id=:id AND client_id=:cid AND status='completed'",
        {"id": data.appointment_id, "cid": user["user_id"]}
    )
    if not appt:
        raise HTTPException(400, "Запись не найдена или не завершена")
    # Проверяем нет ли уже отзыва
    existing = await database.fetch_one(
        "SELECT id FROM reviews WHERE appointment_id=:aid", {"aid": data.appointment_id}
    )
    if existing:
        raise HTTPException(400, "Отзыв уже оставлен")

    rev_id = await database.execute(
        """INSERT INTO reviews (appointment_id, author_id, master_id, service_id, rating, text)
           VALUES (:aid, :uid, :mid, :sid, :r, :t) RETURNING id""",
        {"aid": data.appointment_id, "uid": user["user_id"],
         "mid": appt["master_id"], "sid": appt["service_id"],
         "r": data.rating, "t": data.text}
    )
    return {"id": rev_id, "status": "pending"}

@app.patch("/reviews/{review_id}/moderate")
async def moderate_review(review_id: int, data: ReviewModerate, user=Depends(require_admin)):
    if data.status not in ("approved", "rejected"):
        raise HTTPException(400, "Недопустимый статус")
    await database.execute(
        "UPDATE reviews SET status=:s, admin_reply=:r WHERE id=:id",
        {"s": data.status, "r": data.admin_reply, "id": review_id}
    )
    if data.status == "approved":
        # Обновить рейтинг мастера
        review = await database.fetch_one("SELECT master_id FROM reviews WHERE id=:id", {"id": review_id})
        if review:
            avg = await database.fetch_one(
                "SELECT AVG(rating) AS avg FROM reviews WHERE master_id=:mid AND status='approved'",
                {"mid": review["master_id"]}
            )
            if avg and avg["avg"]:
                await database.execute(
                    "UPDATE masters SET rating=:r WHERE id=:mid",
                    {"r": round(float(avg["avg"]), 1), "mid": review["master_id"]}
                )
    return {"ok": True}

@app.get("/reviews/pending")
async def pending_reviews(user=Depends(require_admin)):
    rows = await database.fetch_all(
        """SELECT rv.*, u.name AS author_name, s.name AS service_name,
                  mu.name AS master_name,
                  CASE WHEN rv.sentiment='negative' THEN true ELSE false END AS priority
           FROM reviews rv
           JOIN users u ON u.id=rv.author_id
           JOIN services s ON s.id=rv.service_id
           JOIN masters m ON m.id=rv.master_id
           JOIN users mu ON mu.id=m.user_id
           WHERE rv.status='pending'
           ORDER BY priority DESC, rv.created_at ASC"""
    )
    return [dict(r) for r in rows]

# ════════════════════════════════════════════════════════════════════
# ИНФОРМАЦИЯ О САЛОНЕ
# ════════════════════════════════════════════════════════════════════
@app.get("/salon-info")
async def salon_info():
    return {
        "name": "Belle Salon",
        "address": "г. Москва, ул. Тверская, д. 10",
        "hours": "Пн–Пт: 9:00–20:00, Сб: 10:00–18:00",
        "phone": "+7 (495) 000-00-00",
        "email": "info@belle-salon.ru",
        "instagram": "https://instagram.com/belle_salon",
        "vk": "https://vk.com/belle_salon",
    }
