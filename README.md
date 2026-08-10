# KODA Practice

Локальный учебный тренажёр pandas: 20 модулей, 60 задач, настоящий запуск Python-кода, автоматическая проверка, подсказки, повторения и прогресс в SQLite. Внешние API и аккаунты не требуются.

## Запуск

Нужны Node.js 20+ и Python 3.12+.

```bash
npm run setup
npm run dev
```

Откройте http://localhost:5173. API и интерактивная OpenAPI-схема доступны на http://localhost:8000/docs.

Команды одинаковы в Windows PowerShell, macOS и Linux. `setup` создаёт `.venv`, устанавливает Python- и npm-зависимости. Если PowerShell запрещает запуск `npm.ps1`, используйте `npm.cmd run setup`.

## Проверка

```bash
npm run test
npm run verify
```

Прогресс хранится в `apps/api/koda.db`. Для чистого старта остановите приложение и удалите только этот файл.

## Безопасность runner

Код выполняется в отдельном Python-процессе с тайм-аутом, из временной директории и с ограниченным набором встроенных функций. Заблокированы сеть, процессы и произвольный доступ к файлам. Это достаточная защита локального однопользовательского MVP; для публичного размещения runner необходимо вынести в контейнер с системными лимитами памяти и сети.

## Цветовые темы

Темы зарегистрированы в `apps/web/src/theme/index.ts`, а их CSS-токены находятся в `apps/web/src/theme/themes.css`. Выбор сохраняется в `localStorage` под ключом `koda:theme`.

```ts
import { setTheme, THEMES } from './theme';

setTheme(THEMES.referenceDark.id);
setTheme(THEMES.neutralLight.id);
setTheme(THEMES.midnight.id);
```

Для добавления темы зарегистрируйте её id в `THEMES` и объявите такой же набор `--theme-*` переменных под новым селектором `html[data-theme="..."]`.

Переносимая палитра для других проектов находится в `theme-exports/` в форматах CSS и JSON.
