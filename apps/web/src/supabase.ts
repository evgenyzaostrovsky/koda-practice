import{createClient}from'@supabase/supabase-js';

export const authEnabled=import.meta.env.VITE_KODA_AUTH_ENABLED==='true';
const url=import.meta.env.VITE_SUPABASE_URL||'';
const key=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
export const authConfigured=authEnabled&&Boolean(url&&key);
export const supabase=authConfigured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;

export function authErrorMessage(message:string){
 const value=message.toLowerCase();
 if(value.includes('invalid login credentials'))return'Неверный email или пароль.';
 if(value.includes('email not confirmed'))return'Сначала подтвердите email по ссылке из письма.';
 if(value.includes('user already registered'))return'Аккаунт с таким email уже существует.';
 if(value.includes('password should be'))return'Пароль должен содержать не менее 6 символов.';
 if(value.includes('rate limit'))return'Слишком много запросов. Попробуйте немного позже.';
 return'Не удалось выполнить запрос. Проверьте данные и соединение.';
}
