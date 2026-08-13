import{createContext,useContext,useEffect,useState,type FormEvent,type ReactNode}from'react';
import type{Session,User}from'@supabase/supabase-js';
import{authConfigured,authEnabled,authErrorMessage,supabase}from'./supabase';
import{loadCloudTasks,saveCloudTask,setCloudUser}from'./cloud-sync';
import{hasLegacyTasks,mergeCloudTaskStates,migrateLegacyTasks,setStorageUser}from'./task-storage';
import{BrandMark}from'./BrandMark';
import{hydrateAchievementsFromCloud,setAchievementCloudUser}from'./achievements/cloud';

type AuthContextValue={user:User|null;session:Session|null;signOut:()=>Promise<void>;updateEmail:(email:string)=>Promise<void>;updatePassword:(password:string)=>Promise<void>};
const AuthContext=createContext<AuthContextValue>({user:null,session:null,signOut:async()=>{},updateEmail:async()=>{},updatePassword:async()=>{}});
let accessToken:string|null=null;
export const getAccessToken=()=>accessToken;
export const useAuth=()=>useContext(AuthContext);

function AuthForm(){
 const[mode,setMode]=useState<'login'|'signup'|'forgot'|'recovery'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{const{data}=supabase!.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY')setMode('recovery')});return()=>data.subscription.unsubscribe()},[]);
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{
  if(mode==='login'){const{error:x}=await supabase!.auth.signInWithPassword({email,password});if(x)throw x}
  if(mode==='signup'){const{data,error:x}=await supabase!.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:location.origin}});if(x)throw x;if(!data.session)setMessage('Проверьте почту и подтвердите регистрацию.')}
  if(mode==='forgot'){const{error:x}=await supabase!.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/reset-password`});if(x)throw x;setMessage('Ссылка для восстановления отправлена на email.')}
  if(mode==='recovery'){const{error:x}=await supabase!.auth.updateUser({password});if(x)throw x;setMessage('Пароль обновлён.');setMode('login')}
 }catch(x){setError(authErrorMessage(x instanceof Error?x.message:String(x)))}finally{setBusy(false)}};
 return <main className="auth-page"><form className="auth-card" onSubmit={submit}><div className="auth-brand"><span><BrandMark size={25}/></span><div><b>KODA</b><small>Practice</small></div></div><h1>{mode==='login'?'Вход':mode==='signup'?'Создать аккаунт':mode==='forgot'?'Восстановление пароля':'Новый пароль'}</h1>{mode==='signup'&&<label>Имя<input value={name} onChange={e=>setName(e.target.value)} required autoComplete="name"/></label>}{mode!=='recovery'&&<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>}{mode!=='forgot'&&<label>Пароль<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required autoComplete={mode==='login'?'current-password':'new-password'}/></label>}{error&&<p className="auth-error">{error}</p>}{message&&<p className="auth-message">{message}</p>}<button className="auth-submit" disabled={busy}>{busy?'Подождите…':mode==='login'?'Войти':mode==='signup'?'Зарегистрироваться':mode==='forgot'?'Отправить ссылку':'Сохранить пароль'}</button>{mode==='login'&&<button type="button" className="auth-link" onClick={()=>setMode('forgot')}>Забыли пароль?</button>}<p>{mode==='signup'?'Уже есть аккаунт?':'Нет аккаунта?'} <button type="button" className="auth-inline" onClick={()=>setMode(mode==='signup'?'login':'signup')}>{mode==='signup'?'Войти':'Зарегистрироваться'}</button></p></form></main>
}

export function AuthProvider({children}:{children:ReactNode}){
 const[session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(authConfigured),[migration,setMigration]=useState(false),[migrating,setMigrating]=useState(false);
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>{setSession(data.session);accessToken=data.session?.access_token??null;setLoading(false)});const{data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);accessToken=next?.access_token??null;setLoading(false)});return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{const current=session?.user??null;setCloudUser(current);setAchievementCloudUser(current);setStorageUser(current?.id??null);if(current){loadCloudTasks().then(mergeCloudTaskStates).catch(()=>{}).finally(()=>setMigration(hasLegacyTasks()&&localStorage.getItem(`koda:migrated:v1:${current.id}`)!=='yes'));hydrateAchievementsFromCloud().catch(()=>{})}},[session?.user.id]);
 if(authEnabled&&!authConfigured)return <main className="auth-page"><div className="auth-card"><h1>Авторизация не настроена</h1><p>Для включения аккаунтов задайте публичные переменные Supabase при сборке.</p></div></main>;
 if(!authEnabled)return <>{children}</>;
 if(loading)return <main className="auth-page"><div className="auth-card"><p>Проверяем сессию…</p></div></main>;
 if(!session)return <AuthForm/>;
 const migrate=async()=>{setMigrating(true);try{for(const task of migrateLegacyTasks())await saveCloudTask(task);localStorage.setItem(`koda:migrated:v1:${session.user.id}`,'yes');setMigration(false);mergeCloudTaskStates(await loadCloudTasks())}finally{setMigrating(false)}};
 return <AuthContext.Provider value={{user:session.user,session,updateEmail:async email=>{const{error}=await supabase!.auth.updateUser({email},{emailRedirectTo:`${location.origin}/profile/settings`});if(error)throw error},updatePassword:async password=>{const{error}=await supabase!.auth.updateUser({password});if(error)throw error},signOut:async()=>{setCloudUser(null);setAchievementCloudUser(null);setStorageUser(null);await supabase!.auth.signOut();accessToken=null}}}>{children}{migration&&<div className="migration-banner"><p>На этом устройстве найден локальный прогресс. Перенести его в аккаунт?</p><button onClick={migrate} disabled={migrating}>{migrating?'Переносим…':'Перенести'}</button><button className="ghost" onClick={()=>setMigration(false)}>Пропустить</button></div>}</AuthContext.Provider>;
}
