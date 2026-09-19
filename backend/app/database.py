from pymongo import MongoClient
from .config import settings

client = MongoClient(
    settings.DATABASE_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000
)


def get_db():
    try:
        db = client.get_default_database()
    except Exception:
        db = client["rural_healthcare"]
    try:
        yield db
    finally:
        pass
