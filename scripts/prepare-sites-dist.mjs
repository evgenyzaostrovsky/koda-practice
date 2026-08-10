import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),web=resolve(root,'apps/web'),dist=resolve(web,'dist');
mkdirSync(resolve(dist,'server'),{recursive:true});
writeFileSync(resolve(dist,'server/index.js'),`export default {async fetch(request,env){const response=await env.ASSETS.fetch(request);if(response.status!==404)return response;const url=new URL(request.url);url.pathname='/index.html';return env.ASSETS.fetch(new Request(url,request));}};\n`);
mkdirSync(resolve(dist,'.openai'),{recursive:true});
copyFileSync(resolve(web,'.openai/hosting.json'),resolve(dist,'.openai/hosting.json'));
