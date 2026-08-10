import{describe,expect,it}from'vitest';
import{authErrorMessage}from'./supabase';
describe('auth errors',()=>{it('hides technical Supabase errors',()=>{expect(authErrorMessage('Invalid login credentials')).toBe('Неверный email или пароль.');expect(authErrorMessage('internal database detail')).toBe('Не удалось выполнить запрос. Проверьте данные и соединение.')})});
