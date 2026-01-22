# NEUROFIELDRAS — стартовый сайт + CMS schema + Payments API

## Что внутри
- `/style.css` — главный стиль
- статические страницы (index/about/test/materials/checkout/access + legal)
- `/cms/schema.json` — структура CMS (коллекции/поля)
- `/api/openapi.yaml` — спецификация Payments/Webhooks/Access API
- `/server` — demo backend (Express + SQLite) с mock оплатой

## Запуск backend (demo)
```bash
cd server
cp .env.example .env
npm i
npm run db:init
npm run dev
```

## Статика
Откройте папку сайта через любой static server (например Live Server в VS Code).
Для работы API используйте тот же домен/порт, либо настройте reverse proxy.

## Реальные оплаты
- Реализуйте `POST /api/payments/create` под YooKassa/Sber/Stripe
- Реализуйте `POST /api/payments/webhook` с проверкой подписи и сменой статуса заказа
- Выдачу оставьте через `GET /api/access/:token`
