from datetime import datetime, timedelta, timezone
import ast
import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel
from .content import MODULES,TOPICS,EXERCISES,THEORY_ARTICLES,KNOWLEDGE_UNITS,KNOWLEDGE_BY_SLUG,public_module,public_exercise
from .db import init_db,connect,now
from .runner import run,explain,compare_results,warmup
from .auth_backend import AUTH_ENABLED,current_user,record_attempt,rest
from .sandbox_storage import create_file, delete_file, file_content, list_files, rename_file

class ApiPrefixMiddleware:
    def __init__(self,app): self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']=='http' and scope.get('path','').startswith('/api/'):
            scope=dict(scope)
            scope['path']=scope['path'][4:]
            scope['raw_path']=scope['path'].encode('utf-8')
        await self.app(scope,receive,send)

class SpaStaticFiles(StaticFiles):
    async def get_response(self,path,scope):
        try:
            response=await super().get_response(path,scope)
        except StarletteHTTPException as exc:
            if exc.status_code==404 and scope['method']=='GET':
                return await super().get_response('index.html',scope)
            raise
        if response.status_code==404 and scope['method']=='GET':
            return await super().get_response('index.html',scope)
        path_value=scope.get('path','')
        if '/achievements/icons/' in path_value:
            response.headers['Cache-Control']='public, max-age=31536000, immutable'
            if path_value.endswith('.webp'): response.headers['Content-Type']='image/webp'
        elif path_value.endswith('/achievements/manifest.json'):
            response.headers['Cache-Control']='public, max-age=3600, stale-while-revalidate=86400'
        return response

app=FastAPI(title='KODA Practice API',version='1.0.0')
origins=[x.strip() for x in os.environ.get('KODA_CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=['*'],allow_headers=['*'])
app.add_middleware(ApiPrefixMiddleware)
@app.on_event('startup')
def startup(): init_db(); app.state.runner=warmup()
EXPECTED_RESULTS={}
class CodeIn(BaseModel): exercise_id:str; code:str
class ReviewIn(BaseModel): result:str='success'
class SandboxRenameIn(BaseModel): name:str

def used_methods(code:str)->set[str]:
    try: tree=ast.parse(code)
    except SyntaxError: return set()
    return {n.attr for n in ast.walk(tree) if isinstance(n,ast.Attribute)} | {n.id for n in ast.walk(tree) if isinstance(n,ast.Name)}

def json_preview(value):
    if value is None:return None
    return json.dumps(value,ensure_ascii=False,default=str)[:1200]

def attempt_dataset(e):
    return {'files':e['dataset'].get('files',{})} if e['dataset'].get('files') else {}

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
@app.get('/theory/{article_id}')
def theory_article(article_id:str):
    article=THEORY_ARTICLES.get(article_id)
    if not article: raise HTTPException(404,'Материал не найден')
    return article
@app.get('/knowledge')
def knowledge_index(): return KNOWLEDGE_UNITS
@app.get('/knowledge/{slug}')
def knowledge_detail(slug:str):
    unit=KNOWLEDGE_BY_SLUG.get(slug)
    if not unit: raise HTTPException(404,'Материал не найден')
    return unit
@app.get('/sandbox/files')
def sandbox_files(request:Request):
    return list_files(current_user(request))
@app.post('/sandbox/files',status_code=201)
async def sandbox_upload(request:Request,file:UploadFile=File(...)):
    return await create_file(current_user(request),file)
@app.get('/sandbox/files/{file_id}/content')
def sandbox_content(file_id:str,request:Request):
    content,name=file_content(current_user(request),file_id)
    return Response(content,media_type='text/csv',headers={'Content-Disposition':f'attachment; filename="{name.encode("ascii","ignore").decode() or "dataset.csv"}"'})
@app.patch('/sandbox/files/{file_id}')
def sandbox_rename(file_id:str,body:SandboxRenameIn,request:Request):
    return rename_file(current_user(request),file_id,body.name)
@app.delete('/sandbox/files/{file_id}',status_code=204)
def sandbox_delete(file_id:str,request:Request):
    delete_file(current_user(request),file_id)
    return Response(status_code=204)
@app.post('/executions/run')
def execute(body:CodeIn,request:Request):
    current_user(request)
    e=EXERCISES.get(body.exercise_id)
    if not e: raise HTTPException(404,'Задача не найдена')
    r=run(body.code,attempt_dataset(e),e['result_variable']);
    if not r.get('ok'): r['explanation']=explain(r)
    return r
@app.post('/attempts/submit')
def submit(body:CodeIn,request:Request):
    account=current_user(request)
    e=EXERCISES.get(body.exercise_id)
    if not e: raise HTTPException(404,'Задача не найдена')
    actual=run(body.code,attempt_dataset(e),e['result_variable'])
    expected=EXPECTED_RESULTS.get(body.exercise_id)
    if expected is None:
        expected=run(e['solution_code'],e['dataset'],e['result_variable'],setup_code=e['setup_code']);EXPECTED_RESULTS[body.exercise_id]=expected
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
    if account:
        feedback=None if passed else explain(actual)
        num,hints=record_attempt(account,body.exercise_id,body.code,passed,actual.get('result',{}).get('kind',actual.get('error_type','error')),feedback,actual.get('execution_ms',0))
    if missing and actual.get('ok') and equal:
        calls=', '.join(f"pd.{name}()" if name.startswith('read_') else f"{name}()" for name in sorted(missing))
        actual.update(error_type='WrongMethod',error='Результат верный, но задача проверяет конкретный приём.',difference=f"Используйте вызов {calls}, не раскрывая готовое решение.")
    details=explain(actual)
    if not passed:
        details.update(expected=actual.get('expected') or json_preview(expected.get('result')),actual=actual.get('actual') or json_preview(actual.get('result')),hint=e['hints'][min(hints,2)]['text'])
    return {**actual,'passed':passed,'tests_passed':int(passed),'tests_total':1,'attempt_number':num,'hints_used':hints,'xp_earned':e['xp'] if passed else 0,'approach':e['completion_summary'],'completion_summary':e['completion_summary'],'explanation':None if passed else details}
@app.post('/exercises/{eid}/hints/{level}')
def hint(eid:str,level:int,request:Request):
    account=current_user(request)
    e=EXERCISES.get(eid)
    if not e or level not in (1,2,3): raise HTTPException(404,'Подсказка не найдена')
    with connect() as c:c.execute('INSERT OR IGNORE INTO hints VALUES(?,?,?)',(eid,level,now()))
    if account:
        rows=rest(account,'task_progress','GET',params={'user_id':f"eq.{account['id']}",'task_id':f'eq.{eid}','select':'*'}) or []
        payload=rows[0] if rows else {'user_id':account['id'],'task_id':eid,'code':'','status':'not_started','attempts_count':0}
        payload['hints_opened']=max(payload.get('hints_opened',0),level)
        rest(account,'task_progress?on_conflict=user_id,task_id','POST',payload,prefer='resolution=merge-duplicates,return=minimal')
    return {'level':level,'content':e['hints'][level-1]['text']}
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
def progress(request:Request):
    account=current_user(request)
    if account:
        cloud=rest(account,'task_progress','GET',params={'user_id':f"eq.{account['id']}",'select':'*'}) or []
        attempts=rest(account,'solution_attempts','GET',params={'user_id':f"eq.{account['id']}",'select':'task_id,passed,created_at','order':'created_at.asc'}) or []
        solved={x['task_id'] for x in cloud if x['status']=='completed'}; module_progress=[]
        for m in MODULES:
            ids=[e['id'] for t in m['topics'] for e in t['exercises']];done=len(set(ids)&solved);mastery=round(done/len(ids)*100)
            module_progress.append({'slug':m['slug'],'title':m['title'],'solved':done,'solved_ids':[i for i in ids if i in solved],'total':len(ids),'mastery':mastery,'status':'mastered' if mastery>=80 else 'learning' if done else 'not_started'})
        return {'solved':len(solved),'solved_ids':sorted(solved),'total':len(EXERCISES),'attempts':len(attempts),'first_try_accuracy':0,'independent_rate':0,'hints_used':sum(x.get('hints_opened',0) for x in cloud),'xp':sum(EXERCISES[i]['xp'] for i in solved),'due':0,'modules':module_progress,'activity':[],'recent_errors':[]}
    with connect() as c:
        rows=c.execute('SELECT * FROM attempts ORDER BY id').fetchall(); hints=c.execute("SELECT COUNT(*) FROM hints WHERE exercise_id NOT LIKE 'v1:%'").fetchone()[0]; activity=[dict(x) for x in c.execute('SELECT * FROM activity ORDER BY day DESC LIMIT 28')]; due_n=c.execute("SELECT COUNT(*) FROM reviews WHERE exercise_id NOT LIKE 'v1:%' AND completed_at IS NULL AND due_at<=?",(now(),)).fetchone()[0]
    attempts=[dict(x) for x in rows if x['exercise_id'] in EXERCISES]; solved={x['exercise_id'] for x in attempts if x['status']=='passed'}; first={}
    for x in attempts:first.setdefault(x['exercise_id'],x)
    first_acc=sum(x['status']=='passed' for x in first.values())/len(first) if first else 0; independent=sum(x['status']=='passed' and not x['hints_used'] for x in attempts)/len(attempts) if attempts else 0
    module_progress=[]
    for m in MODULES:
        ids=[e['id'] for t in m['topics'] for e in t['exercises']]; done=len(set(ids)&solved); mastery=round(100*(.5*(sum(first.get(i,{}).get('status')=='passed' for i in ids)/len(ids))+.3*(sum(any(a['exercise_id']==i and a['status']=='passed' and not a['hints_used'] for a in attempts) for i in ids)/len(ids))+.2*(done/len(ids))))
        module_progress.append({'slug':m['slug'],'title':m['title'],'solved':done,'solved_ids':[i for i in ids if i in solved],'total':len(ids),'mastery':mastery,'status':'mastered' if mastery>=80 else 'learning' if done else 'not_started'})
    return {'solved':len(solved),'solved_ids':sorted(solved),'total':len(EXERCISES),'attempts':len(attempts),'first_try_accuracy':round(first_acc*100),'independent_rate':round(independent*100),'hints_used':hints,'xp':sum(EXERCISES[i]['xp'] for i in solved),'due':due_n,'modules':module_progress,'activity':activity,'recent_errors':[x for x in reversed(attempts) if x['status']=='failed'][:20]}

WEB_DIST=Path(__file__).parents[2]/'web'/'dist'
if WEB_DIST.is_dir():
    app.mount('/',SpaStaticFiles(directory=WEB_DIST,html=True),name='web')
