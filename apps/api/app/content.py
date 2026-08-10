import json
from pathlib import Path

ROOT=Path(__file__).parents[3]
CATALOG=json.loads((ROOT/'content/catalog.json').read_text(encoding='utf-8'))
THEORY_BANK=json.loads((ROOT/'content/theory_bank.json').read_text(encoding='utf-8'))
THEORY_ARTICLES=THEORY_BANK['articles']
MODULES=CATALOG['modules']
TOPICS={t['slug']:t for m in MODULES for t in m['topics']}
EXERCISES={e['id']:e for t in TOPICS.values() for e in t['exercises']}

def validate_catalog():
    required={'id','topic_id','title','difficulty','instructions','dataset','setup_code','starter_code','expected_type','solution_code','theory_article_id','required_tokens','tests','hints','learning_objective','completion_summary','explanation','xp'}
    if CATALOG.get('bank_version')!=2: raise ValueError('Unsupported content bank version')
    if len(TOPICS)!=20 or len(EXERCISES)!=200: raise ValueError('Catalog must contain 20 topics and 200 exercises')
    for topic in TOPICS.values():
        if len(topic['exercises'])!=10: raise ValueError(f"{topic['slug']}: expected 10 exercises")
        for exercise in topic['exercises']:
            missing=required-set(exercise)
            if missing: raise ValueError(f"{exercise.get('id','unknown')}: missing {sorted(missing)}")
            if exercise['theory_article_id'] not in THEORY_ARTICLES: raise ValueError(f"{exercise['id']}: theory article not found")
            if len(exercise['hints'])!=3 or not all(x.get('level')==i and x.get('text','').strip() for i,x in enumerate(exercise['hints'],1)): raise ValueError(f"{exercise['id']}: invalid hints")

validate_catalog()

def public_exercise(e):
    return {k:v for k,v in e.items() if k not in ('solution_code',)}

def public_module(m):
    return {**m,'topics':[{**t,'exercises':[public_exercise(e) for e in t['exercises']]} for t in m['topics']]}
