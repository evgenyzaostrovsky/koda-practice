"""Route-level regression checks; all writes are confined to pytest tmp_path."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))
from app import db, main
from app.routers import practice as practice_routes, progress as progress_routes
from app.services import practice as practice_service, progress as progress_service


@pytest.fixture
def isolated_api(tmp_path, monkeypatch):
    monkeypatch.setattr(db, 'DB', tmp_path / 'isolated.sqlite')
    monkeypatch.setattr(main, 'warmup', lambda: None)
    account = lambda request: {'id': request.headers.get('x-test-user', 'A'), 'token': 'test-only'}
    monkeypatch.setattr(practice_routes, 'current_user', account)
    monkeypatch.setattr(progress_routes, 'current_user', account)
    cloud = {}
    def rest(user, path, method='GET', json=None, params=None, prefer=None):
        if path.startswith('task_progress'):
            key = (user['id'], (params or {}).get('task_id', 'eq.start-001').removeprefix('eq.'))
            if method == 'GET':
                return [dict(cloud[key])] if key in cloud else []
            if method == 'POST':
                key = (user['id'], json['task_id'])
                if key not in cloud or 'ignore-duplicates' not in (prefer or ''):
                    cloud[key] = {'hints_opened': 0, **json}
            if method == 'PATCH' and key in cloud:
                upper_bound = (params or {}).get('hints_opened')
                if not upper_bound or cloud[key]['hints_opened'] < int(upper_bound.removeprefix('lt.')):
                    cloud[key].update(json)
        return []
    monkeypatch.setattr(progress_service, 'rest', rest)
    with TestClient(main.app) as client:
        yield client, cloud


def test_account_hint_does_not_pollute_shared_offline_progress(isolated_api):
    client, _ = isolated_api
    assert client.post('/exercises/start-001/hints/1', headers={'x-test-user': 'A'}).status_code == 200
    with db.connect() as conn:
        assert conn.execute('SELECT COUNT(*) FROM hints').fetchone()[0] == 0


def test_other_accounts_hints_do_not_unlock_solution(isolated_api):
    client, _ = isolated_api
    for level in (1, 2, 3):
        assert client.post(f'/exercises/start-001/hints/{level}', headers={'x-test-user': 'A'}).status_code == 200
    response = client.post('/exercises/start-001/solution', headers={'x-test-user': 'B'})
    assert response.status_code == 403
    assert client.post('/exercises/start-001/solution', headers={'x-test-user': 'A'}).status_code == 200


def test_account_submission_does_not_pollute_shared_offline_progress(isolated_api, monkeypatch):
    client, _ = isolated_api
    monkeypatch.setattr(practice_service, 'run', lambda *args, **kwargs: {'ok': False, 'error_type': 'SyntaxError', 'error': 'invalid syntax', 'execution_ms': 1})
    monkeypatch.setattr(progress_service, 'record_attempt', lambda *args: (1, 0))
    response = client.post('/attempts/submit', json={'exercise_id': 'start-001', 'code': 'invalid python'}, headers={'x-test-user': 'A'})
    assert response.status_code == 200
    with db.connect() as conn:
        assert conn.execute('SELECT COUNT(*) FROM attempts').fetchone()[0] == 0
        assert conn.execute('SELECT COUNT(*) FROM activity').fetchone()[0] == 0


def test_account_cannot_read_or_complete_offline_reviews(isolated_api):
    client, _ = isolated_api
    with db.connect() as conn:
        conn.execute("INSERT INTO reviews(exercise_id,interval_days,due_at) VALUES('start-001',2,'2020-01-01T00:00:00Z')")
        review_id = conn.execute('SELECT id FROM reviews').fetchone()[0]
    assert client.get('/reviews/due').json() == []
    assert client.post(f'/reviews/{review_id}/complete', json={'result': 'success'}).status_code == 404
    with db.connect() as conn:
        assert conn.execute('SELECT completed_at FROM reviews').fetchone()[0] is None


def test_reopening_earlier_hint_preserves_completion_and_highest_hint(isolated_api):
    client, cloud = isolated_api
    cloud[('A', 'start-001')] = {'user_id': 'A', 'task_id': 'start-001', 'hints_opened': 3, 'status': 'completed', 'attempts_count': 7, 'code': 'my checked code'}
    assert client.post('/exercises/start-001/hints/1').status_code == 200
    assert cloud[('A', 'start-001')] == {'user_id': 'A', 'task_id': 'start-001', 'hints_opened': 3, 'status': 'completed', 'attempts_count': 7, 'code': 'my checked code'}
