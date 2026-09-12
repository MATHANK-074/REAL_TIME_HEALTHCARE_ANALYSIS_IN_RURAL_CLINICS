from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routers import auth, users, patients, health_records, predictions, alerts, followups, locations, dashboard, field_visits, notifications
app = FastAPI(
    title="RuralCare AI - Healthcare Risk Prediction API",
    description="Backend API for AI-Powered Rural Healthcare Analytics and Risk Prediction",
    version="1.0.0"
)

# CORS Configuration
# Allows React Vite development server (running on port 5173) to communicate with API
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
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
app.include_router(field_visits.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")

# Ensure indexes for notifications collection exist
@app.on_event("startup")
async def startup_indexes():
    from .database import get_db
    for db in get_db():
        db.notifications.create_index([("recipient_id", 1), ("is_read", 1), ("created_at", -1)])
        break


@app.get("/api/health")
def health_check():
    """Simple API health check endpoint."""
    return {
        "status": "healthy",
        "environment": os.getenv("ENV", "development"),
        "timestamp": os.getenv("CURRENT_TIME", "2026-08-07T07:05:00")
    }
