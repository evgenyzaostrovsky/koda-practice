import ast, json, sys
from pathlib import Path
p=Path(__file__).parents[1]/'content/catalog.json'
d=json.loads(p.read_text(encoding='utf-8'))
assert len(d['modules'])==20, 'Нужно ровно 20 модулей'
ex=[e for m in d['modules'] for t in m['topics'] for e in t['exercises']]
assert len(ex)>=50, 'Нужно минимум 50 задач'
ids=[e['id'] for e in ex]; assert len(ids)==len(set(ids)), 'ID задач не уникальны'
for m in d['modules']:
 assert m['topics'] and m['title'] and m['description']
 for t in m['topics']:
  assert t['theory'] and t['syntax'] and t['mistakes'] and t['methods']
  for e in t['exercises']:
   for k in ('title','instructions','starter_code','solution_code','dataset','hints'):
    assert e.get(k), f"{e.get('id')}: нет {k}"
   assert len(e['hints'])==3 and all(str(h).strip() for h in e['hints'])
   available=set(e['dataset'])-{'variables','files'}|set(e['dataset'].get('variables',{}))|{'pd','np','plt','sns','result'}
   used={n.id for n in ast.walk(ast.parse(e['solution_code'])) if isinstance(n,ast.Name)}
   assert used<=available, f"{e['id']}: неизвестные переменные {used-available}"
if '--solutions' in sys.argv:
 sys.path.insert(0,str(p.parents[1]/'apps/api'))
 from app.runner import run
 failures=[]
 for e in ex:
  r=run(e['solution_code'],e['dataset'],e.get('result_variable','result'))
  if not r.get('ok'): failures.append((e['id'],r.get('error')))
  starter=run(e['starter_code'],e['dataset'],e.get('result_variable','result'))
  if starter.get('ok') and starter.get('result')==r.get('result'): failures.append((e['id'],'starter code уже проходит проверку'))
 assert not failures, f'Ошибки эталонных решений: {failures}'
print(f"Контент валиден: {len(d['modules'])} модулей, {len(ex)} задач" + ('; эталонные решения выполнены' if '--solutions' in sys.argv else ''))
