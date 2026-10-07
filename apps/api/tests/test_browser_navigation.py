"""Browser deep links must serve the SPA without changing API clients."""
import pytest
from fastapi.testclient import TestClient
from app import main
from app.content import KNOWLEDGE_UNITS


@pytest.mark.parametrize('path', ['/topics/start', '/knowledge', f"/knowledge/{KNOWLEDGE_UNITS[0]['slug']}", '/progress'])
def test_browser_html_navigation_and_api_json_are_separate(path, monkeypatch):
    if not (main.WEB_DIST / 'index.html').is_file():
        pytest.skip('Production web build unavailable: apps/web/dist/index.html missing')
    monkeypatch.setattr(main, 'warmup', lambda: None)
    with TestClient(main.app) as client:
        navigation = client.get(path, headers={'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'})
        assert navigation.status_code == 200
        assert navigation.headers['content-type'].startswith('text/html')
        assert 'id="root"' in navigation.text
        prefixed = client.get(f'/api{path}', headers={'accept': 'text/html'})
        assert prefixed.status_code == 200
        assert prefixed.headers['content-type'].startswith('application/json')
        legacy = client.get(path, headers={'accept': 'application/json'})
        assert legacy.status_code == 200
        assert legacy.headers['content-type'].startswith('application/json')
        assert legacy.json() == prefixed.json()
