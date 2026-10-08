import ast
import json
from fastapi import HTTPException
from ..content import EXERCISES
from ..runner import run, explain, compare_results
from ..achievement_evidence import achievement_evidence
from .progress import persist_attempt

EXPECTED_RESULTS = {}

def used_methods(code:str, calls_only=False)->set[str]:
    try: tree=ast.parse(code)
    except SyntaxError: return set()
    assignments={target.id:value for node in tree.body if isinstance(node,(ast.Assign,ast.AnnAssign)) for target in ([*node.targets] if isinstance(node,ast.Assign) else [node.target]) if isinstance(target,ast.Name) for value in [node.value]}
    roots=[]; seen=set()
    def include(name):
        if name in seen:return
        seen.add(name)
        value=assignments.get(name)
        if value is not None:
            roots.append(value)
            for child in ast.walk(value):
                if isinstance(child,ast.Name):include(child.id)
    include('result')
    relevant=ast.Module(body=[ast.Expr(value=x) for x in roots],type_ignores=[])
    if calls_only:
        def called_name(function):
            seen_aliases=set()
            while isinstance(function,ast.Name) and function.id in assignments and function.id not in seen_aliases:
                seen_aliases.add(function.id)
                assigned=assignments[function.id]
                if not isinstance(assigned,(ast.Name,ast.Attribute)):break
                function=assigned
            return function.attr if isinstance(function,ast.Attribute) else function.id
        return {called_name(node.func) for node in ast.walk(relevant)
                if isinstance(node,ast.Call) and isinstance(node.func,(ast.Attribute,ast.Name))}
    return (
        {n.attr for n in ast.walk(relevant) if isinstance(n,ast.Attribute)}
        | {n.id for n in ast.walk(relevant) if isinstance(n,ast.Name)}
        | {n.arg for n in ast.walk(relevant) if isinstance(n,ast.keyword) and n.arg}
        | {n.value for n in ast.walk(relevant) if isinstance(n,ast.Constant) and isinstance(n.value,str) and n.value.isidentifier()}
    )

def json_preview(value):
    if value is None:return None
    return json.dumps(value,ensure_ascii=False,default=str)[:1200]

def attempt_dataset(e):
    return {'files':e['dataset'].get('files',{})} if e['dataset'].get('files') else {}

def submit_attempt(body, account):
    e=EXERCISES.get(body.exercise_id)
    if not e: raise HTTPException(404,'Задача не найдена')
    actual=run(body.code,attempt_dataset(e),e['result_variable'],exercise_mode=e.get('exercise_mode','python'))
    expected=EXPECTED_RESULTS.get(body.exercise_id)
    if expected is None:
        expected=run(e['solution_code'],e['dataset'],e['result_variable'],setup_code=e['setup_code'],exercise_mode=e.get('exercise_mode','python'));EXPECTED_RESULTS[body.exercise_id]=expected
    equal,diff=compare_results(actual,expected) if actual.get('ok') else (False,{})
    missing=set(e.get('required_tokens',[]))-used_methods(body.code)
    missing |= set(e.get('required_calls',[]))-used_methods(body.code,calls_only=True)
    passed=actual.get('ok') and equal and not actual.get('mutated_inputs') and not missing
    if actual.get('ok') and actual.get('mutated_inputs'):
        actual.update(diff); actual.update(error_type='WrongAnswer',error='Исходные данные были изменены.',difference=f"Не изменяйте входные переменные: {', '.join(actual['mutated_inputs'])}.")
    elif actual.get('ok') and not passed: actual.update(error_type='WrongAnswer',error='Код выполнен, но result не совпал с ожидаемым.',**diff)
    num,hints=persist_attempt(account,body.exercise_id,body.code,passed,actual,None if passed else explain(actual))
    if missing and actual.get('ok') and equal:
        calls=', '.join(f"pd.{name}()" if name.startswith('read_') else f"{name}()" for name in sorted(missing))
        actual.update(error_type='WrongMethod',error='Результат верный, но задача проверяет конкретный приём.',difference=f"Используйте вызов {calls}, не раскрывая готовое решение.")
    details=explain(actual)
    if not passed:
        details.update(expected=actual.get('expected') or json_preview(expected.get('result')),actual=actual.get('actual') or json_preview(actual.get('result')),hint=e['hints'][min(hints,2)]['text'])
    evidence=achievement_evidence(body.code,e['solution_code']) if passed and e.get('exercise_mode','python') == 'python' else None
    return {**actual,'passed':passed,'tests_passed':int(passed),'tests_total':1,'attempt_number':num,'hints_used':hints,'xp_earned':e['xp'] if passed else 0,'approach':e['completion_summary'],'completion_summary':e['completion_summary'],'achievement_evidence':evidence,'explanation':None if passed else details}
