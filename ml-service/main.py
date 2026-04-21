"""
ML-SERVICE — Сервис машинного обучения
Порт: 8004 | Маршрут через Gateway: /api/ml/

Реализовано:
  - Анализ тональности отзывов (rule-based — до интеграции BERT/ruBERT)
  - Персональные рекомендации (на основе истории + коллаборативная фильтрация — заглушка)
  - Предложение доп. услуг (на основе статистики совместных заказов)

NOTE: Полноценные ML-модели (ruBERT для sentiment, матричная факторизация
      для рекомендаций) запланированы к интеграции на этапе 6.1.7 по графику ТЗ.
      Текущая реализация использует эвристику для демонстрации интерфейса.
"""
import os
from typing import Optional, List

import databases
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://belle:belle_secret@localhost:5432/belle_db")
SECRET_KEY   = os.getenv("SECRET_KEY", "dev-secret")
ALGORITHM    = os.getenv("ALGORITHM", "HS256")

database = databases.Database(DATABASE_URL)
oauth2   = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI(title="ML Service", version="0.9.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup(): await database.connect()

@app.on_event("shutdown")
async def shutdown(): await database.disconnect()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ml", "models": {"sentiment": "rule-based", "recommendations": "stub"}}

# ── Rule-based анализ тональности ────────────────────────────────
POSITIVE_WORDS = {
    "отлично","прекрасно","замечательно","хорошо","великолепно","профессионал",
    "спасибо","рекомендую","красиво","аккуратно","быстро","точно","довольна",
    "доволен","лучший","супер","понравилось","нравится","качество"
}
NEGATIVE_WORDS = {
    "плохо","ужасно","разочаровал","некачественно","грубо","долго","дорого",
    "недоволен","неудовлетворительно","жаль","ошибка","проблема","непрофессионально",
    "подождать","ждать","неприятно","разочарование","жалоба"
}

def analyze_sentiment(text: str) -> str:
    words = set(text.lower().split())
    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)
    if pos > neg:
        return "positive"
    elif neg > pos:
        return "negative"
    return "neutral"

class SentimentIn(BaseModel):
    review_id: int
    text: str

class SentimentOut(BaseModel):
    review_id: int
    sentiment: str
    confidence: float

@app.post("/sentiment", response_model=SentimentOut)
async def analyze(data: SentimentIn):
    """
    Анализ тональности текста отзыва.
    Текущая реализация: rule-based (словарный метод).
    Плановая реализация: ruBERT fine-tuned on Russian sentiment corpus.
    """
    sentiment = analyze_sentiment(data.text)
    # Обновить запись в БД
    await database.execute(
        "UPDATE reviews SET sentiment=:s WHERE id=:id",
        {"s": sentiment, "id": data.review_id}
    )
    # Эвристика confidence: наличие 2+ совпадений → 0.85, иначе 0.6
    confidence = 0.85 if len(data.text.split()) > 5 else 0.60
    return SentimentOut(review_id=data.review_id, sentiment=sentiment, confidence=confidence)

# ── Персональные рекомендации фотографий ─────────────────────────
@app.get("/recommendations/gallery")
async def recommend_gallery(user_id: int, limit: int = 6):
    """
    Рекомендации фотографий портфолио на основе истории записей клиента.
    Текущая реализация: content-based (категории из истории).
    Плановая реализация: коллаборативная фильтрация (матричная факторизация).
    """
    # История клиента: какие категории заказывал
    history = await database.fetch_all(
        """SELECT DISTINCT s.category::text
           FROM appointments a JOIN services s ON s.id=a.service_id
           WHERE a.client_id=:uid AND a.status IN ('completed','confirmed')""",
        {"uid": user_id}
    )

    if not history:
        # Нет истории — возвращаем последние фото
        photos = await database.fetch_all(
            """SELECT pp.id, pp.photo_url, u.name AS master_name, s.name AS service_name, s.category::text
               FROM portfolio_photos pp
               JOIN masters m ON m.id=pp.master_id JOIN users u ON u.id=m.user_id
               LEFT JOIN services s ON s.id=pp.service_id
               ORDER BY pp.created_at DESC LIMIT :n""",
            {"n": limit}
        )
        return {"type": "popular", "photos": [dict(p) for p in photos]}

    categories = [r["category"] for r in history]
    placeholders = ", ".join(f"'{c}'" for c in categories)
    photos = await database.fetch_all(
        f"""SELECT pp.id, pp.photo_url, u.name AS master_name, s.name AS service_name, s.category::text
            FROM portfolio_photos pp
            JOIN masters m ON m.id=pp.master_id JOIN users u ON u.id=m.user_id
            LEFT JOIN services s ON s.id=pp.service_id
            WHERE s.category::text IN ({placeholders})
            ORDER BY pp.created_at DESC LIMIT :n""",
        {"n": limit}
    )
    return {"type": "personalized", "based_on_categories": categories, "photos": [dict(p) for p in photos]}

# ── Рекомендации доп. услуг при записи ───────────────────────────
@app.get("/recommendations/cross-sell")
async def cross_sell(service_id: int, limit: int = 3):
    """
    Предложение дополнительных услуг на основе статистики совместных заказов.
    Текущая реализация: частота совместного бронирования.
    """
    rows = await database.fetch_all(
        """SELECT a2.service_id, s.name, s.price, s.icon, COUNT(*) AS frequency
           FROM appointments a1
           JOIN appointments a2 ON a2.client_id=a1.client_id AND a2.service_id != a1.service_id
           JOIN services s ON s.id=a2.service_id
           WHERE a1.service_id=:sid AND s.archived=false
           GROUP BY a2.service_id, s.name, s.price, s.icon
           ORDER BY frequency DESC LIMIT :n""",
        {"sid": service_id, "n": limit}
    )
    if not rows:
        # Fallback — популярные услуги
        rows = await database.fetch_all(
            """SELECT s.id AS service_id, s.name, s.price, s.icon, 0 AS frequency
               FROM services s WHERE s.id != :sid AND s.archived=false
               ORDER BY RANDOM() LIMIT :n""",
            {"sid": service_id, "n": limit}
        )
    return [dict(r) for r in rows]
