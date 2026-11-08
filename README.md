# Clickear — Migración a App de Escritorio (Electron Híbrido)

> **Documento de orientación para agentes de IA.** Cualquier agente que retome
> este trabajo debe leer este archivo completo ANTES de tocar código, revisar
> la sección [Estado](#5-estado-de-progreso-registro-de-agentes) y continuar
> desde el último ítem sin completar, sin preguntar nada que ya esté decidido aquí.

## 1. Contexto del proyecto

**Clickear** es un sistema de despachos / tickets de soporte / inventario para
técnicos. Es una web app dividida en dos proyectos:

| Parte    | Ruta                              | Stack                                                        |
| -------- | --------------------------------- | ------------------------------------------------------------ |
| Backend  | `backend/` (este repo, canónico)  | Express 5, TS, Prisma 6, PostgreSQL/SQLite, JWT, zod, vitest  |
| Frontend | `~/Desktop/Clickear/Frontend/`    | React 19, Vite, Tailwind 4, shadcn, React Query, React Router |

El backend se importó desde `~/Desktop/Clickear/Backend/` con `git subtree`
(historial preservado) y pasa a ser la fuente canónica. El frontend no se copia:
se consume solo su `dist/` como input de build.

Ambos proyectos están desplegados en **Render**:

- Backend: `https://clickear.onrender.com`
- Frontend: `https://clicke-ar.onrender.com/` — sirve el build de React con
  `Frontend/server.mjs`, que hace proxy de las rutas `/api` hacia el backend
  remoto.

## 2. Objetivo de la migración

Convertir Clickear en una **aplicación de escritorio híbrida con Electron**:

- La app funcionará **100% offline** con un backend Node embebido (Express) y
  **SQLite** local (en `userData` del SO).
- En **modo online**, además autentica y sincroniza contra el backend remoto
  (Render + PostgreSQL).
- El usuario elige el modo (online / offline); v1 de sync usa
  *last-write-wins* para resolver conflictos.

## 3. Decisiones técnicas YA tomadas (no re-preguntar)

> **Actualización 2026-11-08:** el backend ya **no** se consume por ruta
> relativa desde `../Backend`. Se copia a `Clickear-escritorio/backend/` con
> `git subtree` y **pasa a ser la fuente canónica** (Render se re-apunta al
> final). El frontend sigue consumiéndose solo por su `dist/`. Plan vigente:
> `~/.opencode/plan/desktop_backend_plan.md`.

- **Framework de escritorio**: Electron (no Tauri).
- **Modo**: híbrido (offline-first con sincronización opcional).
- **Bundle del backend**: `esbuild` a un único archivo CJS, reutilizando el
  código actual de `../Backend/` sin duplicarlo.
- **Prisma**: doble schema — un `.prisma` para PostgreSQL (existente) y otro
  para SQLite; dos clientes generados en rutas separadas; la variable
  `DATABASE_PROVIDER` decide cuál usar en runtime.
- **Seguridad Electron**: `contextIsolation: true`, `nodeIntegration: false`,
  preload mínimo con `ipcRenderer.invoke`.
- `JWT_SECRET` en desktop se genera y se persiste en `userData` (nunca
  hardcodear ni reutilizar el remoto).
- **Proxy ya existente**: el `../Frontend/server.mjs` reenvía `/api` al backend.
  En desktop, el backend embebido servirá las mismas rutas bajo `/api` en
  `localhost`, de modo que el frontend no cambia su configuración de axios.
- **Monorepo**: este directorio será el workspace raíz de la app de escritorio;
  `../Backend` y `../Frontend` se consumen por ruta relativa, no se copian.

## 4. Fases de implementación

### Fase 0 — Infraestructura Electron

- [x] Crear `Clickear-escritorio/` con este README.
- [x] `package.json` raíz con npm workspaces y scripts `desktop:dev` /
  `desktop:build`.
- [x] `electron/main.ts` — `BrowserWindow` (contextIsolation activo), arranque
  del backend embebido en un puerto libre y carga de
  `http://127.0.0.1:<port>`.
- [x] `electron/preload.ts` — API mínima expuesta vía `ipcRenderer.invoke`.
- [ ] `electron-builder` configurado (dmg macOS universal / NSIS Windows)
  → movido a Fase 4.

### Fase 1 — Backend empaquetable

- [x] Entry point `desktop-main.ts` que escucha en un puerto libre (sin puerto
  fijo) y sin seed de admin automático.
- [x] Bundle `esbuild` → `dist-desktop/main.cjs` incluyendo Prisma Client.
- [ ] Copiar el `query_engine` binario de Prisma a `resources/` y setear
  `PRISMA_QUERY_ENGINE_LIBRARY` antes de instanciar Prisma.
  → la resolución ya funciona en dev; la copia a `resources/` es parte del
  empaquetado (Fase 4).
- [x] Todos los tests existentes del backend siguen en verde (160/160).

### Fase 2 — Prisma SQLite

- [ ] `../Backend/prisma/schema-sqlite.prisma` (mismos modelos, sin
  `@db.VarChar` / `@db.Timestamp`, que son exclusivos de PostgreSQL).
- [ ] Generar dos clientes Prisma en rutas separadas
  (`generated/postgres`, `generated/sqlite`).
- [ ] Migraciones SQLite propias en `../Backend/prisma/sqlite-migrations/`,
  aplicadas automáticamente en el primer arranque.
- [ ] Suite de tests corriendo también contra SQLite.

### Fase 3 — Modo híbrido (Auth + Sync v1)

- [ ] Login dual: online → contra `clickear.onrender.com`; offline → backend
  local.
- [ ] Outbox en SQLite (tabla `pending_sync`) para writes realizados offline.
- [ ] Sincronización con *last-write-wins* por `updatedAt` al reconectar.
- [ ] UI de estado de conexión + cola de sync visible (toasts con `sonner`).

### Fase 4 — Empaquetado y CI

- [ ] Config completa de `electron-builder` (macOS dmg universal + Windows
  NSIS).
- [ ] GitHub Actions + publicación de builds.

## 5. Estado de progreso (registro de agentes)

> **Cada agente debe actualizar esta sección al terminar su sesión.**
> Indicar: fecha, fase/ítems completados, qué quedó a medias y cualquier
> bloqueante. La meta es que ningún agente herede un bloqueante sin resolver:
> si aparece uno, documentarlo acá con el siguiente paso concreto para
> destrabarlo.

### Log

| Fecha      | Fase   | Agente                     | Progreso                                   | Notas / Bloqueantes |
| ---------- | ------ | -------------------------- | ------------------------------------------ | ------------------- |
| 2026-11-08 | —      | Big Pickle (OpenCode)      | Plan definido; directorio y README creados | Nada bloquea. Siguiente: Fase 0, scaffold del workspace `desktop/`. |
| 2026-11-08 | Spike  | Big Pickle (OpenCode)      | Spike esbuild+Prisma **validado**: bundle CJS autocontenido que arranca y responde HTTP | Fix obligatorio: engine por `PRISMA_QUERY_ENGINE_LIBRARY` + `await import()` (no top-level await en CJS). Siguiente: Fase 0. |
| 2026-11-08 | 0 y 1  | Big Pickle (OpenCode)      | Workspace + subtree del backend + Electron funcionando: la ventana carga el React real servido por el backend embebido | `createApp({ mode: "desktop" })` sin rate-limit/HSTS/CORS ni `upgrade-insecure-requests`. Tests 160/160. Falta DB real (Fase 2) y packaging (Fase 4). |

### Próximo paso inmediato

**Fase 2:** `schema-sqlite.prisma`, dos clientes Prisma y migraciones SQLite.
Hoy el backend de escritorio arranca pero apunta a un `DATABASE_URL` placeholder
(cliente Postgres), así que cualquier query falla.

## 6. Convenciones obligatorias

- Código en **inglés** (nombres de variables, funciones, clases); comentarios en
  **español** y solo cuando aporten valor.
- Clean code / SOLID / DRY. Sin magia, sin comentarios superfluos.
- **Después de cada cambio, ejecutar los tests** (`npm test` en este repo y en
  `~/Desktop/Clickear/Frontend`) y no cerrar una fase sin que pasen en verde.
- Marcar un ítem como `[x]` solo cuando su verificación (build/tests) pase.
- **No duplicar código**: el backend es canónico en `backend/` y el frontend se
  consume por su `dist/`. No copiar el frontend a este repo.

## 7. Referencias

- Backend: `backend/README.md`, `backend/src/`, `backend/prisma/schema.prisma`
- Frontend: `~/Desktop/Clickear/Frontend/README.md`,
  `~/Desktop/Clickear/Frontend/src/lib/api.ts` (usa `VITE_API_URL`),
  `~/Desktop/Clickear/Frontend/server.mjs` (proxy en Render)
- Frontend remoto: `https://clicke-ar.onrender.com/`
- Ideas futuras: `backend/lista-de-ideas.md`
- Plan vigente: `~/.opencode/plan/desktop_backend_plan.md`
