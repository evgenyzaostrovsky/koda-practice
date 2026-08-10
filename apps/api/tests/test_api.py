import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).parents[1]))
from fastapi.testclient import TestClient
from app.main import app


def test_catalog_and_private_solutions():
    with TestClient(app) as client:
        response=client.get('/modules')
        assert response.status_code==200
        modules=response.json()
        assert len(modules)==20
        assert sum(len(t['exercises']) for m in modules for t in m['topics'])==200
        assert all(len(t['exercises'])==10 for m in modules for t in m['topics'])
        assert 'solution_code' not in str(modules)


def test_groupby_full_cycle():
    with TestClient(app) as client:
        eid='groupby-001'
        bad=client.post('/attempts/submit',json={'exercise_id':eid,'code':'result = df.groupby("category")["sales"].mean()'}).json()
        assert bad['passed'] is False and bad['explanation']['check']
        assert client.post(f'/exercises/{eid}/hints/1').json()['content']
        good=client.post('/attempts/submit',json={'exercise_id':eid,'code':'result = df.groupby("category")["sales"].sum()'}).json()
        assert good['passed'] is True and good['tests_passed']==1


def test_runner_blocks_dangerous_import():
    with TestClient(app) as client:
        response=client.post('/executions/run',json={'exercise_id':'start-001','code':'import os\nresult = 1'}).json()
        assert not response['ok'] and response['error_type']=='SecurityError'


def test_dataframe_creation_contract_and_precise_diff():
    with TestClient(app) as client:
        task=client.get('/exercises/start-001').json()
        assert task['dataset']['variables']['data']=={'name':['Аня','Борис','Вера'],'score':[7,9,8]}
        assert 'solution_code' not in task and task['starter_code'].endswith('result = None')
        wrong=client.post('/attempts/submit',json={'exercise_id':'start-001','code':'result = pd.DataFrame({"name": ["Аня"], "score": [7]})'}).json()
        assert wrong['passed'] is False and wrong['explanation']['difference']
        for level in (1,2,3): assert client.post(f'/exercises/start-001/hints/{level}').status_code==200
        assert client.post('/exercises/start-001/solution').json()['solution']=='result = pd.DataFrame(data)'
        good=client.post('/attempts/submit',json={'exercise_id':'start-001','code':'result = pd.DataFrame(data)'}).json()
        assert good['passed'] is True and good['result']['data']==[['Аня',7],['Борис',9],['Вера',8]]
