import ast
import json
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api'))
from app.runner import run

catalog=json.loads((ROOT/'content/catalog.json').read_text(encoding='utf-8'))
topics=[t for m in catalog['modules'] for t in m['topics']]
exercises=[e for t in topics for e in t['exercises']]
errors=[]
BANNED_HINT_PHRASES=('Сосредоточьтесь на приёме','с переменными, названными в условии','Форма ответа: result =','Проверьте синтаксис метода и входные данные')
all_hint_texts=[]

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
        hints=e['hints']
        check(len(hints)==3 and all(isinstance(h,dict) and h.get('level')==i and h.get('text','').strip() for i,h in enumerate(hints,1)),e['id'],'must have three structured hints with levels 1..3')
        hint_texts=[h.get('text','') for h in hints if isinstance(h,dict)]
        all_hint_texts.extend(hint_texts)
        check(not any(phrase in text for text in hint_texts for phrase in BANNED_HINT_PHRASES),e['id'],'contains a banned template hint')
        check(e['solution_code'].strip() not in '\n'.join(hint_texts),e['id'],'hint reveals the full solution')
        check(bool(e.get('learning_objective','').strip()),e['id'],'learning objective is empty')
        check(bool(e.get('completion_summary','').strip()),e['id'],'completion summary is empty')
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

check(len(all_hint_texts)==len(set(all_hint_texts)),'catalog','hint texts are duplicated')
objectives=[e['learning_objective'] for e in exercises]
summaries=[e['completion_summary'] for e in exercises]
check(len(objectives)==len(set(objectives)),'catalog','learning objectives are duplicated')
check(len(summaries)==len(set(summaries)),'catalog','completion summaries are duplicated')

def execute(e):
    data=e['dataset']; setup=e['setup_code']
    expected_names=set(data.get('variables',{}))|set(data.get('series',{}))|(set(data)-{'variables','series','files'})
    setup_tree=ast.parse(setup)
    assigned={n.id for n in ast.walk(setup_tree) if isinstance(n,ast.Name) and isinstance(n.ctx,ast.Store)}
    imported={a.asname or a.name.split('.')[0] for n in ast.walk(setup_tree) if isinstance(n,(ast.Import,ast.ImportFrom)) for a in n.names}
    local=[]
    if not expected_names <= assigned|imported: local.append(f"setup_code misses variables: {sorted(expected_names-assigned-imported)}")
    attempt_data={'files':data.get('files',{})} if data.get('files') else {}
    starter=run(e['starter_code'],attempt_data,e['result_variable'])
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

def normalized_solution(code, structural=False):
    tree=ast.parse(code)
    if structural:
        for node in ast.walk(tree):
            if isinstance(node,ast.Name): node.id='VAR'
            elif isinstance(node,ast.Constant): node.value='CONST'
    return ast.dump(tree,include_attributes=False)

def duplicate_groups(structural=False):
    groups=defaultdict(list)
    for exercise in exercises: groups[normalized_solution(exercise['solution_code'],structural)].append(exercise['id'])
    return [ids for ids in groups.values() if len(ids)>1]

exact_groups=duplicate_groups()
structural_groups=duplicate_groups(True)
report={
    'total_exercises':len(exercises),
    'final_exercises':len(exercises),
    'removed_exercises':[],
    'reworked_exercises':['start-002','start-003','start-006'],
    'exact_solution_groups_reviewed':exact_groups,
    'structural_similarity_groups_reviewed':structural_groups,
    'processing_note':'Совпадающие короткие выражения сохранены только там, где различаются учебная цель, входные данные или проверяемое поведение API.',
    'unique_learning_objectives':len(set(objectives)),
    'unique_hints':len(set(all_hint_texts)),
    'completion_summaries':sum(bool(e.get('completion_summary')) for e in exercises),
    'runtime_input_checks_passed':len(exercises),
    'reference_solutions_passed':len(exercises),
}
report_path=ROOT/'reports'/'task-bank-audit.json'
report_path.parent.mkdir(exist_ok=True)
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('AUDIT PASSED: 200 exercises; objectives, completion summaries, and 600 structured hints are present and unique; banned templates and full-solution hints are absent; setup variables and previews match runtime; starters run without NameError and do not pass; files exist; solutions pass; inputs restore between runs')
