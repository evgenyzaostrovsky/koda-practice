from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from ..auth_backend import current_user
from ..content import EXERCISES
from ..runner import run
from ..services.practice import submit_attempt, attempt_dataset
from ..services.progress import open_hint, hints_opened

router = APIRouter()
class CodeIn(BaseModel): exercise_id: str; code: str

@router.post('/executions/run')
def execute(body:CodeIn,request:Request):
    current_user(request)
    e=EXERCISES.get(body.exercise_id)
    if not e: raise HTTPException(404,'Задача не найдена')
    return run(body.code,attempt_dataset(e),e['result_variable'],exercise_mode=e.get('exercise_mode','python'))
@router.post('/attempts/submit')
def submit(body: CodeIn, request: Request):
    return submit_attempt(body, current_user(request))

@router.post('/exercises/{eid}/hints/{level}')
def hint(eid: str, level: int, request: Request):
    account = current_user(request)
    exercise = EXERCISES.get(eid)
    if not exercise or level not in (1, 2, 3):
        raise HTTPException(404, 'Подсказка не найдена')
    open_hint(account, eid, level)
    return {'level': level, 'content': exercise['hints'][level-1]['text']}

@router.post('/exercises/{eid}/solution')
def reveal_solution(eid: str, request: Request):
    account = current_user(request)
    exercise = EXERCISES.get(eid)
    if not exercise:
        raise HTTPException(404, 'Задача не найдена')
    if hints_opened(account, eid) < 3:
        raise HTTPException(403, 'Сначала откройте все три подсказки')
    return {'solution': exercise['solution_code']}
