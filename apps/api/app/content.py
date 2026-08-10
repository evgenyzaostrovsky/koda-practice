import json
from pathlib import Path

ROOT=Path(__file__).parents[3]
CATALOG=json.loads((ROOT/'content/catalog.json').read_text(encoding='utf-8'))
MODULES=CATALOG['modules']
TOPICS={t['slug']:t for m in MODULES for t in m['topics']}
EXERCISES={e['id']:e for t in TOPICS.values() for e in t['exercises']}

def validate_catalog():
    required={'id','topic_id','title','difficulty','instructions','dataset','starter_code','expected_type','solution_code','required_tokens','tests','hints','explanation','xp'}
    if CATALOG.get('bank_version')!=2: raise ValueError('Unsupported content bank version')
    if len(TOPICS)!=20 or len(EXERCISES)!=200: raise ValueError('Catalog must contain 20 topics and 200 exercises')
    for topic in TOPICS.values():
        if len(topic['exercises'])!=10: raise ValueError(f"{topic['slug']}: expected 10 exercises")
        for exercise in topic['exercises']:
            missing=required-set(exercise)
            if missing: raise ValueError(f"{exercise.get('id','unknown')}: missing {sorted(missing)}")
            if len(exercise['hints'])!=3 or not all(x.strip() for x in exercise['hints']): raise ValueError(f"{exercise['id']}: invalid hints")

validate_catalog()

def public_exercise(e):
    return {k:v for k,v in e.items() if k not in ('solution_code',)}

def public_module(m):
    return {**m,'topics':[{**t,'exercises':[public_exercise(e) for e in t['exercises']]} for t in m['topics']]}
