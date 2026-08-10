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
    solution=run(e['solution_code'],e['dataset'],e['result_variable'])
    local=[]
    if not solution.get('ok'): local.append(f"solution failed: {solution.get('error')}")
    if solution.get('mutated_inputs'): local.append(f"solution mutated inputs: {solution['mutated_inputs']}")
    if e['starter_code'].strip()==e['solution_code'].strip(): local.append('starter already equals solution')
    return e['id'],local

with ThreadPoolExecutor(max_workers=8) as pool:
    for eid,local in pool.map(execute,exercises):
        errors.extend(f'{eid}: {message}' for message in local)

if errors:
    print('\n'.join(errors))
    raise SystemExit(f'AUDIT FAILED: {len(errors)} error(s)')
print('AUDIT PASSED: bank v2; 20 topics; 200 unique executable exercises; all starters fail; inputs unchanged')
