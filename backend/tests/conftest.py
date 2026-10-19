import os
import sys
import pytest
from datetime import datetime
from bson import ObjectId
from starlette.testclient import TestClient

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.main import app
from backend.app.database import client, get_db
from backend.app.utils.auth import hash_password, create_access_token

@pytest.fixture(scope="session")
def test_client():
    """Returns a TestClient instance for FastAPI application."""
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="session")
def real_db():
    """Provides access to the active database instance."""
    try:
        db = client.get_default_database()
    except Exception:
        db = client["rural_healthcare"]
    return db

@pytest.fixture(scope="session")
def auth_headers_factory():
    """Factory fixture to create authorization headers for any user dict."""
    def _create_headers(email: str, role: str):
        token = create_access_token(data={"sub": email, "role": role})
        return {"Authorization": f"Bearer {token}"}
    return _create_headers
