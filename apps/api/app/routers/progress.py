from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from ..auth_backend import current_user
from ..services.progress import get_progress
from ..db import connect, now

router = APIRouter()
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
