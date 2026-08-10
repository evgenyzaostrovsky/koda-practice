import{localApi}from'./local-api';
const BASE='/api';
export async function api<T>(path:string,init?:RequestInit):Promise<T>{const hosted=typeof location!=='undefined'&&!['localhost','127.0.0.1'].includes(location.hostname);if(hosted)return localApi<T>(path,init);const r=await fetch(BASE+path,{...init,headers:{'Content-Type':'application/json',...init?.headers}});if(!r.ok)throw new Error((await r.json()).detail||'Ошибка сервера');return r.json()}
