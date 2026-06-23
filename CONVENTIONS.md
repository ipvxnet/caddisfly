# Caddisfly engineering conventions

Cloudflare Workers + D1 (SQLite). No ORM — raw `db.prepare(sql).bind(...).run()/first()/all()`.
This file is the canonical context to prepend when delegating code to a local model
(see scripts/ollama.sh, memory lan-ollama.md). It encodes the rules models get wrong cold.

## Bridge pattern (every per-site table)
Each row sets EXACTLY ONE of `ai_project_id` / `project_id` (XOR); the other stays NULL.
AI-builder projects use `ai_project_id`, refactor projects use `project_id`. Use this helper
(defined locally in each db module — it is NOT exported anywhere):
```js
function keyCol(projectKey) {
  return projectKey.aiProjectId != null
    ? { col: 'ai_project_id', val: projectKey.aiProjectId }
    : { col: 'project_id', val: projectKey.projectId };
}
```
INSERT writes only the resolved column: build it into the SQL —
`INSERT INTO t (${k.col}, ...) VALUES (?, ...)` then `.bind(k.val, ...)`.
Every SELECT/UPDATE/DELETE must scope by `WHERE ${k.col} = ?` so projects can't touch each other's rows.

## D1 API idioms (the quirks models get wrong)
- `db.prepare()` is **NOT async** — never `await db.prepare(...)`.
- Inserted id: `const res = await db.prepare(sql).bind(...).run(); const id = res.meta.last_row_id;`
  (NOT `.lastInsertRowid`). Rows affected: `res.meta.changes`.
- `.all()` returns `{ results: [...] }`, never an array → `const { results } = await ...all();`.
- `.first()` returns the row object or null/undefined.
- Bind exactly as many params as the SQL has placeholders — build conditional WHERE clauses
  AND their bind list together (don't bind a null for an absent placeholder).
- D1 does NOT enforce `ON DELETE CASCADE` by default → delete child rows explicitly.

## Migrations
- `migrations/0NN_name.sql`, sequential. Header: a `-- 0NN_name.sql` title line + a one-line purpose,
  then `-- Apply MANUALLY to BOTH caddisfly-db (preview) and caddisfly-db-prod.`
- `CREATE TABLE IF NOT EXISTS` + `CREATE [UNIQUE] INDEX IF NOT EXISTS`. No FK to other tables
  (bridge tables don't FK). Lookup indexes are NOT unique unless a real uniqueness rule exists.
- Timestamps: `INTEGER NOT NULL DEFAULT (unixepoch())` (unix seconds). Money: INTEGER cents.

## Route handlers
- `async function handle(ctx)`, `ctx = { env, request, params, url }`. `env.DB` is the D1 binding.
- Resolve the project with the existing helper: `const r = await resolveStoreProject(env, params.project_id);`
  → `r.projectKey`, `r.businessName`; null when not found (return 404 / redirect).
- JSON via a local `function json(body, status=200)`. Only map KNOWN validation errors to 4xx;
  rethrow everything else (a DB failure must surface as 500, not a swallowed 400).
- Routes are mounted in src/index.js with `[billingAuth, projectAccess, pluginGate(<plugin>, { json: true })]`
  for APIs / `pluginGate(<plugin>)` for pages. The model writes the handler, not the gate.

## i18n (user-visible strings)
Trilingual EN/ES/PT. Never inline English in a new surface. Either `tr()`/`t(lang,...)` keys,
or a local dict like the catalogue's `CAT_T`:
```js
const T = { en: { k: '...' }, es: { k: '...' }, pt: { k: '...' } };
const lang = (ctx && ctx.lang) || 'en';   // pages: ctx.lang; templates: config.lang
const tr = T[lang] || T.en;
```
Declare `lang`/`tr` BEFORE any code that uses them (watch for temporal-dead-zone). Localize ALL
strings incl. button labels, `<html lang>`, `siteFooter({ lang })`, `<title>`, and JS alert text.
Serialize strings into client JS via `JSON.stringify` (apostrophe-safe), not raw `'${x}'`.
ES is Latin-American (Agregar, not Añadir). Handle singular/plural per language.
