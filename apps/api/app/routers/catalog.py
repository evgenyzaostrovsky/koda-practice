from fastapi import APIRouter, HTTPException
from ..content import MODULES, TOPICS, EXERCISES, THEORY_ARTICLES, KNOWLEDGE_UNITS, KNOWLEDGE_BY_SLUG, public_module, public_exercise

router = APIRouter()

@router.get('/modules')
def modules(): return [public_module(m) for m in MODULES]
@router.get('/topics/{slug}')
def topic(slug:str):
    if slug not in TOPICS: raise HTTPException(404,'Тема не найдена')
    t=TOPICS[slug]; return {**t,'exercises':[public_exercise(e) for e in t['exercises']]}
@router.get('/topics/{slug}/exercises')
def topic_exercises(slug:str):
    if slug not in TOPICS: raise HTTPException(404,'Тема не найдена')
    return [public_exercise(e) for e in TOPICS[slug]['exercises']]
@router.get('/exercises/{eid}')
def exercise(eid:str):
    if eid not in EXERCISES: raise HTTPException(404,'Задача не найдена')
    return public_exercise(EXERCISES[eid])
@router.get('/theory/{article_id}')
def theory_article(article_id:str):
    article=THEORY_ARTICLES.get(article_id)
    if not article: raise HTTPException(404,'Материал не найден')
    return article
@router.get('/knowledge')
def knowledge_index(): return KNOWLEDGE_UNITS
@router.get('/knowledge/{slug}')
def knowledge_detail(slug:str):
    unit=KNOWLEDGE_BY_SLUG.get(slug)
    if not unit: raise HTTPException(404,'Материал не найден')
    return unit
