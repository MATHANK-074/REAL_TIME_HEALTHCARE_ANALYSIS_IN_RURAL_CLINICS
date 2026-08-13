from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .database import engine, Base
from .routers import auth, users, patients, health_records, predictions, alerts, followups, locations, dashboard

# Automatically create database tables if they do not exist
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
except Exception as e:
    print(f"Database table initialization warning (ensure MySQL is running): {str(e)}")

app = FastAPI(
    title="RuralCare AI - Healthcare Risk Prediction API",
    description="Backend API for AI-Powered Rural Healthcare Analytics and Risk Prediction",
    version="1.0.0"
)

# CORS Configuration
# Allows React Vite development server (running on port 5173) to communicate with API
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(patients.router, prefix="/api")
app.include_router(health_records.router, prefix="/api")
app.include_router(predictions.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(followups.router, prefix="/api")
app.include_router(locations.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")

@app.get("/api/health")
def health_check():
    """Simple API health check endpoint."""
    return {
        "status": "healthy",
        "environment": os.getenv("ENV", "development"),
        "timestamp": os.getenv("CURRENT_TIME", "2026-08-07T07:05:00")
    }
