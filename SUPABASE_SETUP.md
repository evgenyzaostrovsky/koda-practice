# Подключение аккаунтов KODA Practice

Код аккаунтов находится за feature flag и не использует фиктивные ключи.

1. Создайте проект в Supabase.
2. Откройте **SQL Editor** и выполните файл `supabase/migrations/202608100001_accounts_and_progress.sql` целиком.
3. В **Authentication → URL Configuration** задайте:
   - Site URL: `https://koda-practice.onrender.com`
   - Redirect URLs: `http://localhost:5173/**` и `https://koda-practice.onrender.com/**`
4. В Render добавьте переменные:
   - `KODA_AUTH_ENABLED=true`
   - `SUPABASE_URL=<Project URL>`
   - `SUPABASE_ANON_KEY=<Publishable/anon key>`
   - `SUPABASE_JWT_AUDIENCE=authenticated`
   - `VITE_KODA_AUTH_ENABLED=true`
   - `VITE_SUPABASE_URL=<Project URL>`
   - `VITE_SUPABASE_ANON_KEY=<Publishable/anon key>`
5. Запустите **Clear build cache & deploy**, поскольку `VITE_*` встраиваются во frontend во время Docker-сборки.

Service-role/secret key приложению не нужен: backend записывает попытки с проверенным пользовательским access token, а Postgres дополнительно ограничивает строки через RLS.

До выполнения этих шагов `KODA_AUTH_ENABLED=false` и `VITE_KODA_AUTH_ENABLED=false` сохраняют текущий публичный режим без входа.
