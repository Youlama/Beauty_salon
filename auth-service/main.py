"""
AUTH-SERVICE — Микросервис аутентификации и авторизации
Порт: 8001 | Маршрут через Gateway: /api/auth/
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import databases
import sqlalchemy
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

# ── Конфигурация ──────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://belle:belle_secret@localhost:5432/belle_db")
SECRET_KEY   = os.getenv("SECRET_KEY", "dev-secret")
ALGORITHM    = os.getenv("ALGORITHM", "HS256")
TOKEN_EXPIRE = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

users_table = sqlalchemy.Table(
    "users", metadata,
    sqlalchemy.Column("id",            sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("name",          sqlalchemy.String),
    sqlalchemy.Column("email",         sqlalchemy.String, unique=True),
    sqlalchemy.Column("phone",         sqlalchemy.String, nullable=True),
    sqlalchemy.Column("password_hash", sqlalchemy.String),
    sqlalchemy.Column("role",          sqlalchemy.String),
    sqlalchemy.Column("created_at",    sqlalchemy.DateTime(timezone=True)),
)

pwd_ctx      = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# ── Pydantic схемы ────────────────────────────────────────────────
class RegisterIn(BaseModel):
    name:     str
    email:    EmailStr
    phone:    Optional[str] = None
    password: str
    role:     str = "client"

class LoginIn(BaseModel):
    email:    EmailStr
    password: str

class UserOut(BaseModel):
    id:    int
    name:  str
    email: str
    phone: Optional[str]
    role:  str

class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut

# ── Утилиты ──────────────────────────────────────────────────────
def make_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": expire}, SECRET_KEY, ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный токен")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise exc
    user = await database.fetch_one(
        users_table.select().where(users_table.c.id == int(payload["sub"]))
    )
    if not user:
        raise exc
    return dict(user)

# ── FastAPI ───────────────────────────────────────────────────────
app = FastAPI(title="Auth Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth"}

# ── Регистрация ───────────────────────────────────────────────────
@app.post("/register", response_model=TokenOut, status_code=201)
async def register(data: RegisterIn):
    existing = await database.fetch_one(
        users_table.select().where(users_table.c.email == data.email)
    )
    if existing:
        raise HTTPException(400, "Email уже зарегистрирован")

    if data.role not in ("client", "master", "admin"):
        raise HTTPException(400, "Недопустимая роль")

    user_id = await database.execute(
        users_table.insert().values(
            name=data.name,
            email=data.email,
            phone=data.phone,
            password_hash=pwd_ctx.hash(data.password),
            role=data.role,
        )
    )
    user = await database.fetch_one(users_table.select().where(users_table.c.id == user_id))
    return TokenOut(access_token=make_token(user["id"], user["role"]), user=UserOut(**dict(user)))

# ── Вход ──────────────────────────────────────────────────────────
@app.post("/login", response_model=TokenOut)
async def login(data: LoginIn):
    user = await database.fetch_one(
        users_table.select().where(users_table.c.email == data.email)
    )
    if not user or not pwd_ctx.verify(data.password, user["password_hash"]):
        raise HTTPException(401, "Неверный email или пароль")
    return TokenOut(access_token=make_token(user["id"], user["role"]), user=UserOut(**dict(user)))

# ── Текущий пользователь ──────────────────────────────────────────
@app.get("/me", response_model=UserOut)
async def me(current: dict = Depends(get_current_user)):
    return UserOut(**current)

# ── Верификация токена (для других сервисов) ──────────────────────
@app.get("/verify")
async def verify(current: dict = Depends(get_current_user)):
    """Используется другими сервисами для проверки JWT."""
    return {"user_id": current["id"], "role": current["role"], "email": current["email"]}
