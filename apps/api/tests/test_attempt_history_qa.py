"""Independent history evidence, privacy and immutable-code regression tests."""
import json
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from app.content import EXERCISES
from app.services import progress


def seed(task='start-001', code='result = 1 / 0', status='failed', feedback=None):
    with db.connect() as conn:
        return conn.execute('INSERT INTO attempts(exercise_id,code,status,error_type,created_at,feedback) VALUES(?,?,?,?,?,?)',
                            (task, code, status, 'ZeroDivisionError' if status=='failed' else None,
                             '2026-10-10T10:00:00Z', json.dumps(feedback) if feedback else None)).lastrowid


def test_guest_paging_detail_and_reads_preserve_evidence():
    with TestClient(app) as client:
        first = seed(feedback={'version':1,'mode':'python','error':'division by zero','error_type':'ZeroDivisionError','line':1})
        seed(task='retired-task')
        second = seed(code='result = 42',status='passed')
        with db.connect() as conn:
            before=[tuple(row) for row in conn.execute('SELECT * FROM attempts ORDER BY id')]
        page=client.get('/attempts/history?limit=1').json()
        assert page['items'][0]['id']==str(second)
        assert 'code' not in page['items'][0]
        assert page['has_more'] and page['next_offset']==1
        next_page=client.get('/attempts/history?limit=1&offset=1').json()
        assert next_page['items'][0]['id']==str(first)
        assert not next_page['has_more'] and next_page['next_offset'] is None
        detail=client.get(f'/attempts/history/{first}').json()
        assert detail['code']=='result = 1 / 0'
        assert detail['feedback']['error']=='division by zero'
        assert detail['feedback']['line']==1
        with db.connect() as conn:
            assert [tuple(row) for row in conn.execute('SELECT * FROM attempts ORDER BY id')]==before


def test_legacy_details_do_not_invent_diagnostics():
    with TestClient(app) as client:
        ident=seed(code='old exact code')
        detail=client.get(f'/attempts/history/{ident}').json()
        assert detail['feedback'] is None
        assert detail['code']=='old exact code'
        assert detail['error_type']=='ZeroDivisionError'


@pytest.mark.parametrize('query',['limit=0','limit=101','offset=-1'])
def test_history_rejects_invalid_paging(query):
    with TestClient(app) as client:
        assert client.get('/attempts/history?'+query).status_code==422


def test_cloud_history_and_detail_always_filter_owner(monkeypatch):
    calls=[]
    ident=str(uuid4())
    row={'id':ident,'task_id':'start-001','passed':False,'created_at':'2026-10-10T10:00:00Z',
         'result_type':'error','code':'private exact code','feedback':{'version':1,'mode':'python','error_type':'NameError','error':'missing name'}}
    def fake_rest(account, table, **kwargs):
        calls.append(kwargs['params'])
        assert kwargs['params']['user_id']=='eq.owner-a'
        return [row]
    monkeypatch.setattr(progress,'rest',fake_rest)
    assert progress.attempt_history({'id':'owner-a'})['items'][0]['id']==ident
    assert progress.attempt_detail({'id':'owner-a'},ident)['code']=='private exact code'
    assert len(calls)==2
    with pytest.raises(Exception) as error:
        progress.attempt_detail({'id':'owner-a'},'bad.eq.other')
    assert error.value.status_code==404
    assert len(calls)==2


def test_failed_submission_keeps_exact_code_and_actual_error_after_later_pass():
    with TestClient(app) as client:
        code='result = 1 / 0'
        failed=client.post('/attempts/submit',json={'exercise_id':'start-001','code':code}).json()
        assert not failed['passed'] and failed['error_type']=='ZeroDivisionError'
        item=client.get('/attempts/history').json()['items'][0]
        detail=client.get('/attempts/history/'+item['id']).json()
        assert detail['code']==code
        assert detail['feedback']['error']==failed['error']
        assert detail['feedback']['error_type']==failed['error_type']
        exercise=EXERCISES['start-001']
        passed=client.post('/attempts/submit',json={'exercise_id':'start-001','code':exercise['setup_code']+'\n'+exercise['solution_code']}).json()
        assert passed['passed'],passed
        assert client.get('/attempts/history/'+item['id']).json()==detail


@pytest.mark.parametrize('task,code,mode',[
    ('market-sql-001','SELECT missing_column FROM orders','sql'),
    ('market-excel-003','{}','excel'),
    ('market-power-bi-003','{}','power-bi'),
])
def test_mode_failures_save_real_mode_and_final_outcome(task,code,mode):
    with TestClient(app) as client:
        response=client.post('/attempts/submit',json={'exercise_id':task,'code':code})
        assert response.status_code==200,response.text
        actual=response.json()
        assert not actual['passed'],actual
        item=client.get('/attempts/history').json()['items'][0]
        detail=client.get('/attempts/history/'+item['id']).json()
        assert detail['feedback']['mode']==mode
        assert detail['feedback']['error_type']==actual['error_type']
        assert detail['feedback']['error']==actual['error']
        assert detail['code']==code


def test_cloud_attempt_feedback_and_resume_result_have_distinct_complete_contracts(monkeypatch):
    from app import auth_backend
    calls=[]
    def rest(account, table, method='GET', payload=None, **kwargs):
        calls.append((table,method,payload,kwargs))
        return [{'attempts_count':2,'hints_opened':1,'status':'completed'}] if method=='GET' else None
    monkeypatch.setattr(auth_backend,'rest',rest)
    final={'ok':False,'passed':False,'error_type':'NameError','error':'missing','explanation':{'what':'missing'},'execution_ms':4}
    feedback={'version':1,'mode':'python','error_type':'NameError','error':'missing','line':1}
    progress.persist_attempt({'id':'owner-a'},'start-001','result = missing',False,final,feedback,final_run_result=final)
    attempt=next(payload for table,method,payload,_ in calls if table=='solution_attempts')
    resumed=next(payload for table,method,payload,_ in calls if table=='task_progress' and method=='PATCH')
    assert attempt['feedback']==feedback and attempt['code']=='result = missing'
    assert resumed['status']=='completed'
    assert resumed['last_run_result']=={**final,'attempt_number':3,'hints_used':1}
    assert all(kwargs.get('params',{}).get('user_id')=='eq.owner-a' for _,method,_,kwargs in calls if method in ('GET','PATCH'))
