from datetime import datetime, timedelta, timezone
import ast
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .content import MODULES,TOPICS,EXERCISES,public_module,public_exercise
from .db import init_db,connect,now
from .runner import run,explain,compare_results

app=FastAPI(title='KODA Practice API',version='1.0.0')
app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:5173','http://127.0.0.1:5173'],allow_methods=['*'],allow_headers=['*'])
@app.on_event('startup')
def startup(): init_db()
class CodeIn(BaseModel): exercise_id:str; code:str
class ReviewIn(BaseModel): result:str='success'

def used_methods(code:str)->set[str]:
    try: tree=ast.parse(code)
    except SyntaxError: return set()
    return {n.attr for n in ast.walk(tree) if isinstance(n,ast.Attribute)} | {n.id for n in ast.walk(tree) if isinstance(n,ast.Name)}

@app.get('/health')
def health(): return {'status':'ok'}
@app.get('/modules')
def modules(): return [public_module(m) for m in MODULES]
@app.get('/topics/{slug}')
def topic(slug:str):
    if slug not in TOPICS: raise HTTPException(404,'Тема не найдена')
    t=TOPICS[slug]; return {**t,'exercises':[public_exercise(e) for e in t['exercises']]}
@app.get('/topics/{slug}/exercises')
def topic_exercises(slug:str):
    if slug not in TOPICS: raise HTTPException(404,'Тема не найдена')
    return [public_exercise(e) for e in TOPICS[slug]['exercises']]
@app.get('/exercises/{eid}')
def exercise(eid:str):
    if eid not in EXERCISES: raise HTTPException(404,'Задача не найдена')
    return public_exercise(EXERCISES[eid])
@app.post('/executions/run')
def execute(body:CodeIn):
    e=EXERCISES.get(body.exercise_id)
    if not e: raise HTTPException(404,'Задача не найдена')
    r=run(body.code,e['dataset'],e['result_variable']);
    if not r.get('ok'): r['explanation']=explain(r)
    return r
@app.post('/attempts/submit')
def submit(body:CodeIn):
    e=EXERCISES.get(body.exercise_id)
    if not e: raise HTTPException(404,'Задача не найдена')
    actual=run(body.code,e['dataset'],e['result_variable']); expected=run(e['solution_code'],e['dataset'],e['result_variable'])
    equal,diff=compare_results(actual,expected) if actual.get('ok') else (False,{})
    missing=set(e.get('required_tokens',[]))-used_methods(body.code)
    passed=actual.get('ok') and equal and not actual.get('mutated_inputs') and not missing
    if actual.get('ok') and actual.get('mutated_inputs'):
        actual.update(diff); actual.update(error_type='WrongAnswer',error='Исходные данные были изменены.',difference=f"Не изменяйте входные переменные: {', '.join(actual['mutated_inputs'])}.")
    elif actual.get('ok') and not passed: actual.update(error_type='WrongAnswer',error='Код выполнен, но result не совпал с ожидаемым.',**diff)
    with connect() as c:
        num=c.execute('SELECT COUNT(*) FROM attempts WHERE exercise_id=?',(body.exercise_id,)).fetchone()[0]+1
        hints=c.execute('SELECT COUNT(*) FROM hints WHERE exercise_id=?',(body.exercise_id,)).fetchone()[0]
        c.execute('INSERT INTO attempts(exercise_id,code,status,tests_passed,tests_total,error_type,execution_ms,attempt_number,hints_used,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',(body.exercise_id,body.code,'passed' if passed else 'failed',int(passed),1,None if passed else actual.get('error_type'),actual.get('execution_ms'),num,hints,now()))
        day=datetime.now().date().isoformat(); c.execute('INSERT INTO activity(day,attempts,solved) VALUES(?,?,?) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1, solved=solved+excluded.solved',(day,1,int(passed)))
        if passed:
            delay=2 if hints else (7 if num==1 else 4); due=(datetime.now(timezone.utc)+timedelta(days=delay)).isoformat()
            c.execute('INSERT INTO reviews(exercise_id,interval_days,due_at) VALUES(?,?,?) ON CONFLICT(exercise_id) DO UPDATE SET interval_days=excluded.interval_days,due_at=excluded.due_at',(body.exercise_id,delay,due))
    if missing:
        actual.update(error_type='WrongMethod',error='Используйте основной метод задания.',difference=f"Не найден обязательный приём: {', '.join(sorted(missing))}.")
    return {**actual,'passed':passed,'tests_passed':int(passed),'tests_total':1,'attempt_number':num,'hints_used':hints,'xp_earned':e['xp'] if passed else 0,'approach':e.get('explanation',f"Результат сохранён в {e['result_variable']}."),'explanation':None if passed else {**explain(actual),'expected':actual.get('expected','Эталонный результат задачи'),'actual':actual.get('actual','Результат выполнения')}}
    return {**actual,'passed':passed,'tests_passed':int(passed),'tests_total':1,'attempt_number':num,'hints_used':hints,'xp_earned':e['xp'] if passed else 0,'approach':f"Решение использует конструкцию из темы и сохраняет результат в {e['result_variable']}.",'explanation':None if passed else {**explain(actual),'expected':actual.get('expected','Эталонный результат задачи'),'actual':actual.get('actual','Результат выполнения')}}
@app.post('/exercises/{eid}/hints/{level}')
def hint(eid:str,level:int):
    e=EXERCISES.get(eid)
    if not e or level not in (1,2,3): raise HTTPException(404,'Подсказка не найдена')
    with connect() as c:c.execute('INSERT OR IGNORE INTO hints VALUES(?,?,?)',(eid,level,now()))
    return {'level':level,'content':e['hints'][level-1]}
@app.post('/exercises/{eid}/solution')
def reveal_solution(eid:str):
    e=EXERCISES.get(eid)
    if not e: raise HTTPException(404,'Задача не найдена')
    with connect() as c: opened=c.execute('SELECT COUNT(*) FROM hints WHERE exercise_id=?',(eid,)).fetchone()[0]
    if opened<3: raise HTTPException(403,'Сначала откройте все три подсказки')
    return {'solution':e['solution_code']}
@app.get('/reviews/due')
def due():
    with connect() as c: rows=c.execute('SELECT * FROM reviews WHERE completed_at IS NULL AND due_at<=? ORDER BY due_at',(now(),)).fetchall()
    return [dict(x) for x in rows]
@app.post('/reviews/{rid}/complete')
def complete(rid:int,body:ReviewIn):
    with connect() as c:c.execute('UPDATE reviews SET completed_at=?,result=? WHERE id=?',(now(),body.result,rid))
    return {'ok':True}
@app.get('/progress')
def progress():
    with connect() as c:
        rows=c.execute('SELECT * FROM attempts ORDER BY id').fetchall(); hints=c.execute("SELECT COUNT(*) FROM hints WHERE exercise_id NOT LIKE 'v1:%'").fetchone()[0]; activity=[dict(x) for x in c.execute('SELECT * FROM activity ORDER BY day DESC LIMIT 28')]; due_n=c.execute("SELECT COUNT(*) FROM reviews WHERE exercise_id NOT LIKE 'v1:%' AND completed_at IS NULL AND due_at<=?",(now(),)).fetchone()[0]
    attempts=[dict(x) for x in rows if x['exercise_id'] in EXERCISES]; solved={x['exercise_id'] for x in attempts if x['status']=='passed'}; first={}
    for x in attempts:first.setdefault(x['exercise_id'],x)
    first_acc=sum(x['status']=='passed' for x in first.values())/len(first) if first else 0; independent=sum(x['status']=='passed' and not x['hints_used'] for x in attempts)/len(attempts) if attempts else 0
    module_progress=[]
    for m in MODULES:
        ids=[e['id'] for t in m['topics'] for e in t['exercises']]; done=len(set(ids)&solved); mastery=round(100*(.5*(sum(first.get(i,{}).get('status')=='passed' for i in ids)/len(ids))+.3*(sum(any(a['exercise_id']==i and a['status']=='passed' and not a['hints_used'] for a in attempts) for i in ids)/len(ids))+.2*(done/len(ids))))
        module_progress.append({'slug':m['slug'],'title':m['title'],'solved':done,'total':len(ids),'mastery':mastery,'status':'mastered' if mastery>=80 else 'learning' if done else 'not_started'})
    return {'solved':len(solved),'total':len(EXERCISES),'attempts':len(attempts),'first_try_accuracy':round(first_acc*100),'independent_rate':round(independent*100),'hints_used':hints,'xp':sum(EXERCISES[i]['xp'] for i in solved),'due':due_n,'modules':module_progress,'activity':activity,'recent_errors':[x for x in reversed(attempts) if x['status']=='failed'][:20]}
