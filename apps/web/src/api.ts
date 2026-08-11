import{getAccessToken}from'./auth';
const BASE='/api';
export async function apiResponse(path:string,init?:RequestInit){const token=getAccessToken();const hasBody=init?.body!==undefined;const form=typeof FormData!=="undefined"&&init?.body instanceof FormData;const r=await fetch(BASE+path,{...init,headers:{...(hasBody&&!form?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{ }),...init?.headers}});if(!r.ok){let detail='Ошибка сервера';try{detail=(await r.json()).detail||detail}catch{}throw new Error(detail)}return r}
export async function api<T>(path:string,init?:RequestInit):Promise<T>{const r=await apiResponse(path,init);return r.status===204?undefined as T:r.json()}
