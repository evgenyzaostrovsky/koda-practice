from starlette.requests import Request
from app.auth_backend import AUTH_ENABLED,current_user
import app.auth_backend as auth_backend
import pytest
from fastapi import HTTPException

def test_auth_is_safely_disabled_without_configuration():
    assert AUTH_ENABLED is False
    request=Request({'type':'http','headers':[]})
    assert current_user(request) is None

def test_protected_api_rejects_missing_token(monkeypatch):
    monkeypatch.setattr(auth_backend,'AUTH_ENABLED',True)
    monkeypatch.setattr(auth_backend,'SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setattr(auth_backend,'SUPABASE_ANON_KEY','public-key')
    with pytest.raises(HTTPException) as error:auth_backend.current_user(Request({'type':'http','headers':[]}))
    assert error.value.status_code==401

def test_protected_api_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(auth_backend,'AUTH_ENABLED',True)
    monkeypatch.setattr(auth_backend,'SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setattr(auth_backend,'SUPABASE_ANON_KEY','public-key')
    class Response:
        status_code=401
        def json(self):return {'message':'invalid token'}
    monkeypatch.setattr(auth_backend.httpx,'get',lambda *args,**kwargs:Response())
    request=Request({'type':'http','headers':[(b'authorization',b'Bearer forged')]})
    with pytest.raises(HTTPException) as error:auth_backend.current_user(request)
    assert error.value.status_code==401

def test_rls_migration_covers_every_user_table():
    from pathlib import Path
    sql=(Path(__file__).parents[3]/'supabase/migrations/202608100001_accounts_and_progress.sql').read_text(encoding='utf-8')
    for table in ('profiles','task_progress','solution_attempts','user_state'):
        assert f'alter table public.{table} enable row level security' in sql
        for operation in ('select','insert','update','delete'):assert operation in sql
    assert "auth.uid())=user_id" in sql
