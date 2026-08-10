import{getAccessToken}from'./auth';
const BASE='/api';
export async function api<T>(path:string,init?:RequestInit):Promise<T>{const token=getAccessToken();const r=await fetch(BASE+path,{...init,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...init?.headers}});if(!r.ok)throw new Error((await r.json()).detail||'Ошибка сервера');return r.json()}
