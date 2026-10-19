import os
import pytest
from backend.app.config import settings
from backend.app.ml.model_registry import load_ml_model

def test_fastapi_starts_and_health_endpoint(test_client):
    """Verify FastAPI application starts and returns healthy response."""
    response = test_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "healthy"
    assert "environment" in data
    assert "timestamp" in data

def test_mongodb_connection_safe_ping(real_db):
    """Verify safe read-only ping command succeeds against MongoDB."""
    ping_result = real_db.client.admin.command("ping")
    assert ping_result.get("ok") == 1

def test_required_configuration_available():
    """Verify critical settings are loaded."""
    assert settings.DATABASE_URL is not None
    assert settings.JWT_SECRET is not None
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0

def test_all_five_primary_ml_models_loadable():
    """Verify all primary models can be resolved and loaded from disk."""
    core_models = ["DIABETES", "HEART_DISEASE", "HYPERTENSION", "KIDNEY", "STROKE"]
    for model_name in core_models:
        model = load_ml_model(model_name)
        assert model is not None
        assert hasattr(model, "predict_proba") or hasattr(model, "predict")
