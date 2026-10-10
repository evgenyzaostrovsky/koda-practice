from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from ..auth_backend import current_user
from ..services.progress import get_progress, attempt_history, attempt_detail
from ..db import connect, now

router = APIRouter()
@router.get('/attempts/history')
def history(request:Request,offset:int=Query(0,ge=0,le=100000),limit:int=Query(30,ge=1,le=100)):
    return attempt_history(current_user(request),offset,limit)

@router.get('/attempts/history/{attempt_id}')
def history_detail(attempt_id:str,request:Request):
    return attempt_detail(current_user(request),attempt_id)

class ReviewIn(BaseModel): result: str = 'success'

@router.get('/reviews/due')
def due(request:Request):
    if current_user(request): return []
    with connect() as c: rows=c.execute('SELECT * FROM reviews WHERE completed_at IS NULL AND due_at<=? ORDER BY due_at',(now(),)).fetchall()
    return [dict(x) for x in rows]
@router.post('/reviews/{rid}/complete')
def complete(rid:int,body:ReviewIn,request:Request):
    if current_user(request): raise HTTPException(404,'Повторение не найдено')
    with connect() as c:c.execute('UPDATE reviews SET completed_at=?,result=? WHERE id=?',(now(),body.result,rid))
    return {'ok':True}
@router.get('/progress')
def progress(request:Request):
    return get_progress(current_user(request))
