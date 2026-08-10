import os
import httpx
from fastapi import HTTPException,Request

AUTH_ENABLED=os.environ.get('KODA_AUTH_ENABLED','false').lower()=='true'
SUPABASE_URL=os.environ.get('SUPABASE_URL','').rstrip('/')
SUPABASE_ANON_KEY=os.environ.get('SUPABASE_ANON_KEY','')
AUDIENCE=os.environ.get('SUPABASE_JWT_AUDIENCE','authenticated')

def current_user(request:Request):
    if not AUTH_ENABLED:return None
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:raise HTTPException(503,'Авторизация сервера не настроена')
    header=request.headers.get('authorization','')
    if not header.startswith('Bearer '):raise HTTPException(401,'Требуется вход в аккаунт')
    token=header[7:]
    try:
        response=httpx.get(f'{SUPABASE_URL}/auth/v1/user',headers={'apikey':SUPABASE_ANON_KEY,'Authorization':f'Bearer {token}'},timeout=10)
        payload=response.json() if response.status_code==200 else None
    except Exception as exc:raise HTTPException(503,'Не удалось проверить сессию') from exc
    if not payload or not payload.get('id'):raise HTTPException(401,'Сессия недействительна или истекла')
    return {'id':payload['id'],'token':token}

def rest(user,path,method='GET',json=None,params=None,prefer=None):
    headers={'apikey':SUPABASE_ANON_KEY,'Authorization':f"Bearer {user['token']}"}
    if prefer:headers['Prefer']=prefer
    response=httpx.request(method,f'{SUPABASE_URL}/rest/v1/{path}',headers=headers,json=json,params=params,timeout=15)
    if response.status_code>=400:raise HTTPException(502,'Не удалось синхронизировать данные аккаунта')
    return response.json() if response.content else None

def record_attempt(user,task_id,code,passed,result_type,feedback,execution_ms):
    rest(user,'solution_attempts','POST',{'user_id':user['id'],'task_id':task_id,'code':code,'passed':bool(passed),'result_type':result_type,'feedback':feedback,'execution_ms':execution_ms},prefer='return=minimal')
    rows=rest(user,'task_progress','GET',params={'user_id':f"eq.{user['id']}",'task_id':f'eq.{task_id}','select':'attempts_count,hints_opened,status'}) or []
    old=rows[0] if rows else {}; status='completed' if passed or old.get('status')=='completed' else 'in_progress'
    payload={'user_id':user['id'],'task_id':task_id,'code':code,'status':status,'attempts_count':old.get('attempts_count',0)+1,'hints_opened':old.get('hints_opened',0),'last_run_status':'passed' if passed else 'failed','last_run_result':feedback}
    if passed:payload['completed_at']=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
    rest(user,'task_progress?on_conflict=user_id,task_id','POST',payload,prefer='resolution=merge-duplicates,return=minimal')
    return payload['attempts_count'],payload['hints_opened']
