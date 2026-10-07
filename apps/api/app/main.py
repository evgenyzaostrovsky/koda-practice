import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from .db import init_db
from .runner import warmup
from .routers import catalog, practice, sandbox, progress
from .services.practice import used_methods  # Compatibility for existing callers.

class ApiPrefixMiddleware:
    def __init__(self,app): self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']=='http' and scope.get('path','').startswith('/api/'):
            scope=dict(scope)
            scope['path']=scope['path'][4:]
            scope['raw_path']=scope['path'].encode('utf-8')
        elif scope['type']=='http' and scope.get('method')=='GET' and WEB_DIST.is_dir():
            # Browser navigation must reach the SPA even where legacy API routes
            # share its URL. Explicit /api/* and JSON clients retain API behavior.
            path=scope.get('path','')
            route=path.strip('/').split('/',1)[0]
            spa_routes={'topics','knowledge','progress','errors','catalog','practice',
                        'sandbox','achievements','profile','design-prototype','design-system'}
            accepts_html=any(
                part.split(';',1)[0].strip().lower()=='text/html'
                and not any(param.strip().lower() in {'q=0','q=0.0','q=0.00','q=0.000'}
                            for param in part.split(';')[1:])
                for name,value in scope.get('headers',[])
                if name.lower()==b'accept'
                for part in value.decode('latin-1').split(',')
            )
            if route in spa_routes and accepts_html:
                scope=dict(scope)
                scope['path']='/index.html'
                scope['raw_path']=b'/index.html'
        await self.app(scope,receive,send)

class SpaStaticFiles(StaticFiles):
    async def get_response(self,path,scope):
        try:
            response=await super().get_response(path,scope)
        except StarletteHTTPException as exc:
            if exc.status_code==404 and scope['method']=='GET':
                response=await super().get_response('index.html',scope)
            else: raise
        if response.status_code==404 and scope['method']=='GET':
            response=await super().get_response('index.html',scope)
        path_value=scope.get('path','')
        if '/achievements/icons/' in path_value:
            response.headers['Cache-Control']='public, max-age=31536000, immutable'
            if path_value.endswith('.webp'): response.headers['Content-Type']='image/webp'
        elif path_value.endswith('/achievements/manifest.json'):
            response.headers['Cache-Control']='public, max-age=3600, stale-while-revalidate=86400'
        elif path_value.endswith('/sandbox-worker.js') or not Path(path_value).suffix:
            response.headers['Cache-Control']='no-cache, no-store, must-revalidate'
        elif '/assets/' in path_value:
            response.headers['Cache-Control']='public, max-age=31536000, immutable'
        return response

app=FastAPI(title='KODA Practice API',version='1.0.0')
origins=[x.strip() for x in os.environ.get('KODA_CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=['*'],allow_headers=['*'])
app.add_middleware(ApiPrefixMiddleware)
@app.on_event('startup')
def startup(): init_db(); app.state.runner=warmup()
@app.get('/health')
def health(): return {'status':'ok','commit':os.environ.get('RENDER_GIT_COMMIT','local')}

for router in (catalog.router, practice.router, sandbox.router, progress.router):
    app.include_router(router)

WEB_DIST=Path(__file__).parents[2]/'web'/'dist'
if WEB_DIST.is_dir():
    app.mount('/',SpaStaticFiles(directory=WEB_DIST,html=True),name='web')
