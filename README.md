# Meridian CRM — projeto fullstack

## Como rodar
1. Abra a pasta no VS Code.
2. No terminal: `npm install`
3. Depois: `npm start`
4. Acesse http://localhost:3000

## Estrutura
- `server.js` — API REST (Express). Rotas em `/api/clientes` e `/api/negocios` (GET, POST, PUT, DELETE).
- `data/db.json` — "banco de dados" em arquivo JSON. Fácil de ler, mas não é o ideal para produção.
- `public/` — frontend estático (HTML, CSS, JS puro), servido pelo próprio Express.

## Trocar por um banco de verdade
Hoje os dados ficam em `data/db.json`. Para migrar para Postgres, MySQL, SQLite ou MongoDB,
troque só as funções `lerDB()` e `salvarDB()` em `server.js` — as rotas (`app.get`, `app.post`...)
continuam iguais, só muda de onde os dados vêm e para onde vão. Exemplo com Postgres:
- instale `pg` (`npm install pg`)
- troque `lerDB()`/`salvarDB()` por queries SQL (`SELECT * FROM clientes`, `INSERT INTO...`)
- ajuste os `id` para vir do banco (serial/uuid) em vez de `crypto.randomBytes`

## Próximos passos sugeridos
- Autenticação (login) antes de liberar as rotas da API
- Validação mais rígida dos dados de entrada
- Paginação nas listagens quando o volume crescer
- Deploy (Render, Railway, Fly.io, ou VPS próprio)
