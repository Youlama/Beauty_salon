"""
ANALYTICS-SERVICE — Сервис аналитики
Порт: 8003 | Маршрут через Gateway: /api/analytics/

Реализовано:
  - Выручка по периодам
  - Загрузка мастеров
  - Популярность услуг
  - Статистика отзывов
  - Прогноз загрузки (базовая модель — скользящее среднее)
  - Экспорт отчётов PDF/XLSX (заглушка — в разработке, возвращает структуру данных)
"""
import os
from typing import Optional
from datetime import date, timedelta
import json

import databases
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from jose import JWTError, jwt

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://belle:belle_secret@localhost:5432/belle_db")
SECRET_KEY   = os.getenv("SECRET_KEY", "dev-secret")
ALGORITHM    = os.getenv("ALGORITHM", "HS256")

database = databases.Database(DATABASE_URL)
oauth2   = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI(title="Analytics Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

async def require_admin(token: Optional[str] = Depends(oauth2)):
    if not token:
        raise HTTPException(401, "Требуется авторизация")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(403, "Только для администратора")
        return payload
    except JWTError:
        raise HTTPException(401, "Неверный токен")

@app.on_event("startup")
async def startup(): await database.connect()

@app.on_event("shutdown")
async def shutdown(): await database.disconnect()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics"}

# ── Выручка по периоду ────────────────────────────────────────────
@app.get("/revenue")
async def revenue(
    date_from: str = Query(default=str(date.today() - timedelta(days=30))),
    date_to:   str = Query(default=str(date.today())),
    user=Depends(require_admin)
):
    rows = await database.fetch_all(
        """SELECT date::text, SUM(total_price) AS revenue, COUNT(*) AS appointments
           FROM appointments
           WHERE date BETWEEN :f AND :t AND status='completed'
           GROUP BY date ORDER BY date""",
        {"f": date_from, "t": date_to}
    )
    total = sum(float(r["revenue"] or 0) for r in rows)
    return {
        "date_from": date_from, "date_to": date_to,
        "total_revenue": total,
        "by_day": [{"date": r["date"], "revenue": float(r["revenue"] or 0), "appointments": r["appointments"]} for r in rows]
    }

# ── Загрузка мастеров ─────────────────────────────────────────────
@app.get("/masters-load")
async def masters_load(
    date_from: str = Query(default=str(date.today() - timedelta(days=30))),
    date_to:   str = Query(default=str(date.today())),
    user=Depends(require_admin)
):
    rows = await database.fetch_all(
        """SELECT mu.name AS master_name, COUNT(*) AS total_appointments,
                  COUNT(CASE WHEN a.status='completed' THEN 1 END) AS completed,
                  SUM(CASE WHEN a.status='completed' THEN a.total_price ELSE 0 END) AS revenue
           FROM appointments a
           JOIN masters m ON m.id=a.master_id
           JOIN users mu ON mu.id=m.user_id
           WHERE a.date BETWEEN :f AND :t
           GROUP BY mu.name""",
        {"f": date_from, "t": date_to}
    )
    return [dict(r) for r in rows]

# ── Популярность услуг ────────────────────────────────────────────
@app.get("/popular-services")
async def popular_services(user=Depends(require_admin)):
    rows = await database.fetch_all(
        """SELECT s.name, s.category::text, COUNT(*) AS bookings,
                  SUM(CASE WHEN a.status='completed' THEN a.total_price ELSE 0 END) AS revenue
           FROM appointments a JOIN services s ON s.id=a.service_id
           GROUP BY s.id, s.name, s.category ORDER BY bookings DESC"""
    )
    return [dict(r) for r in rows]

# ── Статистика отзывов ────────────────────────────────────────────
@app.get("/reviews-stats")
async def reviews_stats(user=Depends(require_admin)):
    total = await database.fetch_one("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE status='approved'")
    dist  = await database.fetch_all(
        "SELECT rating, COUNT(*) AS cnt FROM reviews WHERE status='approved' GROUP BY rating ORDER BY rating DESC"
    )
    sentiment = await database.fetch_all(
        "SELECT sentiment::text, COUNT(*) AS cnt FROM reviews WHERE status='approved' GROUP BY sentiment"
    )
    return {
        "total": total["n"],
        "average": round(float(total["avg"] or 0), 1),
        "by_rating": [dict(r) for r in dist],
        "by_sentiment": [dict(r) for r in sentiment]
    }

# ── Прогноз загрузки (скользящее среднее) ────────────────────────
@app.get("/forecast")
async def forecast(days_ahead: int = 14, user=Depends(require_admin)):
    """
    Прогноз числа записей на ближайшие N дней.
    Метод: скользящее среднее по аналогичным дням недели за последние 4 недели.
    """
    masters = await database.fetch_all("SELECT m.id, u.name FROM masters m JOIN users u ON u.id=m.user_id")
    result = []

    for master in masters:
        forecast_days = []
        for i in range(1, days_ahead + 1):
            target_date = date.today() + timedelta(days=i)
            dow = target_date.weekday()  # 0=Mon
            # Среднее за последние 4 недели для этого дня недели
            hist = await database.fetch_all(
                """SELECT COUNT(*) AS cnt FROM appointments
                   WHERE master_id=:mid
                     AND EXTRACT(DOW FROM date) = :dow
                     AND date BETWEEN CURRENT_DATE - INTERVAL '28 days' AND CURRENT_DATE
                     AND status NOT IN ('cancelled')
                   GROUP BY date""",
                {"mid": master["id"], "dow": (dow + 1) % 7}
            )
            avg_load = round(sum(r["cnt"] for r in hist) / max(len(hist), 1), 1) if hist else 0
            forecast_days.append({
                "date": str(target_date),
                "predicted_appointments": avg_load
            })

        result.append({
            "master_id":   master["id"],
            "master_name": master["name"],
            "forecast":    forecast_days
        })

    return result

# ── Экспорт (заглушка — модуль в разработке) ─────────────────────
@app.get("/export")
async def export_report(format: str = "xlsx", user=Depends(require_admin)):
    """
    Экспорт отчёта в PDF/XLSX.
    ⚠️  Модуль в активной разработке — функция будет доступна в следующей версии.
    Возвращает структурированные данные для ручного экспорта.
    """
    revenue_data = await database.fetch_all(
        """SELECT date::text, SUM(total_price) AS revenue, COUNT(*) AS appointments
           FROM appointments WHERE status='completed'
           GROUP BY date ORDER BY date DESC LIMIT 30"""
    )
    return JSONResponse({
        "status": "in_development",
        "message": "Экспорт PDF/XLSX находится в разработке. Данные для экспорта:",
        "format": format,
        "data": [dict(r) for r in revenue_data]
    })
