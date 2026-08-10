import ast
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.runner import run

catalog=json.loads((ROOT/'content/catalog.json').read_text(encoding='utf-8'))
topics=[t for m in catalog['modules'] for t in m['topics']]
exercises=[e for t in topics for e in t['exercises']]
errors=[]

def check(ok, eid, message):
    if not ok: errors.append(f'{eid}: {message}')

check(catalog.get('bank_version')==2,'catalog','bank_version must be 2')
check(len(topics)==20,'catalog',f'expected 20 topics, got {len(topics)}')
check(len(exercises)==200,'catalog',f'expected 200 exercises, got {len(exercises)}')
ids=[e['id'] for e in exercises]
check(len(ids)==len(set(ids)),'catalog','exercise IDs are not unique')
instructions=[e['instructions'] for e in exercises]
check(len(instructions)==len(set(instructions)),'catalog','exercise instructions are duplicated')

for topic in topics:
    check(len(topic['exercises'])==10,topic['slug'],f"expected 10 exercises, got {len(topic['exercises'])}")
    titles=[e['title'] for e in topic['exercises']]
    check(len(titles)==len(set(titles)),topic['slug'],'titles are duplicated inside topic')
    for position,e in enumerate(topic['exercises'],1):
        check(e['id'].endswith(f'-{position:03d}'),e['id'],'wrong order/ID')
        check(bool(e['starter_code'].strip()),e['id'],'starter code is empty')
        check(len(e['hints'])==3 and all(h.strip() for h in e['hints']),e['id'],'must have exactly three hints')
        check(bool(e.get('explanation','').strip()),e['id'],'explanation is empty')
        files=e['dataset'].get('files',{})
        csv_path=e['dataset'].get('variables',{}).get('csv_path')
        if csv_path: check(csv_path in files,e['id'],f'CSV {csv_path!r} is unavailable')
        available=(set(e['dataset'])-{'variables','files','series'})|set(e['dataset'].get('variables',{}))|set(e['dataset'].get('series',{}))|{'pd','np','plt','sns','result','fig','ax'}
        tree=ast.parse(e['solution_code'])
        local_args={arg.arg for node in ast.walk(tree) if isinstance(node,ast.Lambda) for arg in node.args.args}
        used={n.id for n in ast.walk(tree) if isinstance(n,ast.Name)}-local_args
        builtins={'True','False','None'}
        check(not (used-available-builtins),e['id'],f"unknown variables: {sorted(used-available-builtins)}")

def execute(e):
    data=e['dataset']; setup=e['setup_code']
    expected_names=set(data.get('variables',{}))|set(data.get('series',{}))|(set(data)-{'variables','series','files'})
    setup_tree=ast.parse(setup)
    assigned={n.id for n in ast.walk(setup_tree) if isinstance(n,ast.Name) and isinstance(n.ctx,ast.Store)}
    imported={a.asname or a.name.split('.')[0] for n in ast.walk(setup_tree) if isinstance(n,(ast.Import,ast.ImportFrom)) for a in n.names}
    local=[]
    if not expected_names <= assigned|imported: local.append(f"setup_code misses variables: {sorted(expected_names-assigned-imported)}")
    starter=run(e['starter_code'],data,e['result_variable'],setup_code=setup)
    if not starter.get('ok'): local.append(f"starter failed before solution: {starter.get('error_type')}: {starter.get('error')}")
    elif starter.get('result',{}).get('data') is not None: local.append('starter already produces a non-empty result')
    solution=run(e['solution_code'],data,e['result_variable'],setup_code=setup)
    if not solution.get('ok'): local.append(f"solution failed: {solution.get('error')}")
    if solution.get('mutated_inputs'): local.append(f"solution mutated inputs: {solution['mutated_inputs']}")
    if e['starter_code'].strip()==e['solution_code'].strip(): local.append('starter already equals solution')
    for name,frame in [(k,v) for k,v in data.items() if k not in {'variables','series','files'}]:
        preview=run(f'result = {name}',data,'result',setup_code=setup)
        expected_rows=[[frame[col][i] for col in frame] for i in range(len(next(iter(frame.values()),[])))]
        if preview.get('result',{}).get('columns')!=list(frame) or preview.get('result',{}).get('data')!=expected_rows:
            local.append(f'preview differs from runtime DataFrame {name}')
    for name,spec in data.get('series',{}).items():
        preview=run(f'result = {name}',data,'result',setup_code=setup)
        if preview.get('result',{}).get('data')!=spec.get('data',[]): local.append(f'preview differs from runtime Series {name}')
    target=next(iter([k for k in data if k not in {'variables','series','files'}]),None) or next(iter(data.get('series',{})),None)
    if target:
        mutation=run(f'{target}.iloc[0] = None\nresult = {target}',data,'result',setup_code=setup)
        if not mutation.get('mutated_inputs'):local.append(f'input mutation was not detected for {target}')
        restored=run(f'result = {target}',data,'result',setup_code=setup)
        baseline=run(f'result = {target}',data,'result',setup_code=setup)
        if restored.get('result')!=baseline.get('result'):local.append(f'input {target} was not restored between runs')
    return e['id'],local

with ThreadPoolExecutor(max_workers=8) as pool:
    for eid,local in pool.map(execute,exercises):
        errors.extend(f'{eid}: {message}' for message in local)

if errors:
    print('\n'.join(errors))
    raise SystemExit(f'AUDIT FAILED: {len(errors)} error(s)')
print('AUDIT PASSED: 200 exercises; setup variables and previews match runtime; starters run without NameError and do not pass; files exist; solutions pass; inputs restore between runs')
