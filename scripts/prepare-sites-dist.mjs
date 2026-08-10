import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),web=resolve(root,'apps/web'),dist=resolve(web,'dist'),client=resolve(dist,'client');
mkdirSync(client,{recursive:true});
renameSync(resolve(dist,'index.html'),resolve(client,'index.html'));
renameSync(resolve(dist,'catalog.json'),resolve(client,'catalog.json'));
cpSync(resolve(dist,'assets'),resolve(client,'assets'),{recursive:true});
mkdirSync(resolve(dist,'server'),{recursive:true});
const files={
  '/index.html':readFileSync(resolve(client,'index.html'),'utf8'),
  '/catalog.json':readFileSync(resolve(client,'catalog.json'),'utf8'),
};
for(const name of readdirSync(resolve(client,'assets')))files[`/assets/${name}`]=readFileSync(resolve(client,'assets',name),'utf8');
writeFileSync(resolve(dist,'server/index.js'),`const files=${JSON.stringify(files)};const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};export default {async fetch(request){const url=new URL(request.url);const path=files[url.pathname]?url.pathname:(request.headers.get('accept')||'').includes('text/html')?'/index.html':null;if(!path)return new Response('Not found',{status:404});const ext=path.slice(path.lastIndexOf('.'));return new Response(files[path],{headers:{'content-type':types[ext]||'text/plain; charset=utf-8','cache-control':path==='/index.html'?'no-cache':'public, max-age=31536000, immutable'}});}};\n`);
mkdirSync(resolve(dist,'.openai'),{recursive:true});
copyFileSync(resolve(web,'.openai/hosting.json'),resolve(dist,'.openai/hosting.json'));
