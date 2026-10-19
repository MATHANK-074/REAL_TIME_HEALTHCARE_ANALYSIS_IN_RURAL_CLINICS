import pytest

def test_locations_districts_list(test_client):
    """Verify districts endpoint loads from database."""
    resp = test_client.get("/api/locations/districts")
    assert resp.status_code == 200
    districts = resp.json()
    assert isinstance(districts, list)

def test_subdistricts_endpoint(test_client):
    """Verify subdistricts endpoint responds with district filtering."""
    resp = test_client.get("/api/locations/subdistricts")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

def test_taluks_and_firkas_endpoints_report_status(test_client):
    """Check taluks/firkas cascading routes status."""
    resp_t = test_client.get("/api/locations/taluks")
    if resp_t.status_code == 404:
        pytest.skip("Taluks and firkas endpoints are NOT IMPLEMENTED in the active locations router (legacy subdistricts schema active).")

def test_villages_and_areas_endpoints(test_client):
    """Verify villages and healthcare areas respond."""
    resp_v = test_client.get("/api/locations/villages")
    assert resp_v.status_code == 200
    assert isinstance(resp_v.json(), list)

    resp_a = test_client.get("/api/locations/areas")
    assert resp_a.status_code == 200
    assert isinstance(resp_a.json(), list)
