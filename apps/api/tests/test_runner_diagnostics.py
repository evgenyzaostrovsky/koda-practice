import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).parents[1]))
from fastapi.testclient import TestClient
from app.main import app
from app.runner import run
from app.content import EXERCISES

def submit(client,eid,code):
    return client.post('/attempts/submit',json={'exercise_id':eid,'code':code}).json()

def test_required_runner_scenarios():
    with TestClient(app) as client:
        csv=submit(client,'reading-001','result = pd.read_csv(csv_path)')
        assert csv['passed'] is True

        missing_method=submit(client,'reading-001',"result = pd.DataFrame({'x': [1]})")
        assert missing_method['passed'] is False

        syntax=submit(client,'start-001','result = pd.DataFrame(data')
        assert syntax['explanation']['kind']=='syntax_error' and syntax['explanation']['line']==1

        name=submit(client,'start-001','result = missing_name')
        assert name['explanation']['kind']=='runtime_error' and 'missing_name' in name['error']

        file_error=submit(client,'reading-001',"result = pd.read_csv('missing.csv')")
        assert file_error['explanation']['kind']=='runtime_error' and file_error['available_files']

        absent=submit(client,'start-001','value = pd.DataFrame(data)')
        assert absent['explanation']['kind']=='missing_result'

        scalar=submit(client,'start-001','result = 42')
        assert scalar['explanation']['kind']=='wrong_type'

        series=submit(client,'groupby-001','result = pd.Series([1, 2], index=[\"A\", \"B\"])')
        assert series['passed'] is False and series['explanation']['kind'] in {'wrong_value','wrong_shape','wrong_index'}

        frame=submit(client,'start-001','result = pd.DataFrame({\"name\":[\"Аня\"],\"score\":[7]})')
        assert frame['explanation']['kind']=='wrong_shape'

        timeout=run('while True: pass',{},timeout_ms=200)
        assert timeout['error_type']=='TimeoutError'

        plot=submit(client,'pandas-plots-001',EXERCISES['pandas-plots-001']['solution_code'])
        assert plot['passed'] is True and plot['result']['kind']=='plot'

def test_setup_code_and_representative_course_inputs():
    with TestClient(app) as client:
        task=client.get('/exercises/start-001').json()
        assert task['starter_code']=="# Переменная data уже создана\nresult = None"
        assert "import pandas as pd" in task['setup_code']
        assert "data = {'name': ['Аня', 'Борис', 'Вера'], 'score': [7, 9, 8]}" in task['setup_code']
        assert task['dataset']['_setup_code']==task['setup_code']
        scenarios=[
          'start-001','reading-001','columns-003','series-methods-001','merge-001',
          'filtering-007','sorting-004','pivot-006','datetime-007','seaborn-001'
        ]
        for eid in scenarios:
            response=submit(client,eid,EXERCISES[eid]['solution_code'])
            assert response['passed'] is True,(eid,response.get('error'),response.get('explanation'))
        csv=client.get('/exercises/reading-001').json()
        assert "csv_path = 'data.csv'" in csv['setup_code']
        merged=client.get('/exercises/merge-001').json()
        assert 'left = pd.DataFrame' in merged['setup_code'] and 'right = pd.DataFrame' in merged['setup_code']
