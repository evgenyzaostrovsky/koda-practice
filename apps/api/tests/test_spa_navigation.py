from fastapi.testclient import TestClient
from app.main import app


def test_browser_navigation_and_api_requests_remain_distinct():
    with TestClient(app) as client:
        for path in ('/topics/start', '/knowledge', '/progress'):
            page = client.get(path, headers={'Accept': 'text/html'})
            assert page.status_code == 200
            assert 'text/html' in page.headers['content-type']
            assert 'id="root"' in page.text
            data = client.get('/api' + path, headers={'Accept': 'text/html'})
            assert data.status_code == 200
            assert 'application/json' in data.headers['content-type']
        legacy = client.get('/topics/start', headers={'Accept': 'application/json'})
        assert legacy.status_code == 200
        assert legacy.json()['slug'] == 'start'
