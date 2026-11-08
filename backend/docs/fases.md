# Roadmap de Fases — Estado del Proyecto

Fuente original: `lista-de-ideas.md`. Este documento refleja el estado real,
se actualiza al cierre de cada fase.

---

## Fase 0 — Configuración Base e Infraestructura ✅

- [x] Repositorio, TypeScript, estructura de proyecto, Prettier.
- [x] `docker-compose.yml` con **Postgres 16** (`:5433` — ver DEC-002) y **Redis 7** (`:6379`), healthy checks.
- [x] Prisma 6.19: schema con las 10 tablas (9 módulos + tabla N:M), migración `init` aplicada.
- [x] Server Express con health check, manejo centralizado de errores, serialización BigInt/Decimal.
- [x] Documentación: `docs/api.md`, `docs/decisiones.md`, este archivo.

**Commit:** `cc33a70`

---

## Fase 1+2 — Backend Módulo Tickets y Despacho ✅

- [x] CRUD de Establecimientos (listado con filtros, detalle, alta, update parcial, baja en cascada).
- [x] Órdenes de despacho: alta transaccional (vincula técnicos N:M + asigna establecimientos) y
      listado con filtros (`listStatus`, `dispatchCode`) + detalle.
- [x] CRUD mínimo de Técnicos (listado con búsqueda + alta).
- [x] Listado de Tickets con filtros: `status`, `establishment` (CUE), `technicianId`, `search` + paginación.
- [x] Detalle de ticket (`GET /api/tickets/:id`): establecimiento → orden → técnicos + facturas asociadas.
- [x] Extras: alta de ticket (`POST` con `ticketId` externo de GLPI) y cambio de
      estado (`PATCH /:id/status`: `ABIERTO` → `EN PROGRESO` → `TERMINADO`).

**Decisiones durante la fase:** DEC-003 (`ticketId` explícito, sin autoincrement), DEC-004 (BigInt), DEC-005 (error handler).

**Commits:** `4570f8e`

---

## Fase 3 ✅ — Backend Módulo Inventario y Stock

- [x] CRUD de Proveedores (`suppliers`) y Empleados (`employees`).
- [x] CRUD de Ítems de Stock (`inventory_items`) con proveedor (set null en baja).
- [x] Transacción de asignación `POST /api/assignments`:
  - Validar disponibilidad (`available_quantity` sin quedar negativo).
  - `delivery_date` obligatorio, `return_date` opcional.
  - Resta atómica de `available_quantity`.
- [x] `GET /api/employees/:id/assignments` — stock en custodia por empleado.
- [x] Devolución (`PUT /api/assignments/:id/return`) — re-suma al depósito.

**Extras:** ajuste diferencial de stock (`PATCH /inventory-items/:id/stock`),
listado global de asignaciones (`GET /api/assignments`), campo `website` en
`suppliers` (migración `20261101044805_add_supplier_website`).

---

## Fase 4 ✅ — Frontend (Interfaz Web)

Implementado por completo en el repo `Frontend/` (ver su
[`README.md`](../Frontend/README.md) para el detalle por etapa):

- Layout con sidebar + health del backend, React Router, TanStack Query.
- Tickets: listado por establecimiento, filtros, detalle, alta y cambio de estado.
- Inventario: stock con bajo stock, custodia por empleado, asignar material,
  ajuste de stock y devoluciones.
- Facturación: tabla de comprobantes con badges de estado (emisión real pendiente).
- **Proveedores**: alta y listado en `/inventory/suppliers` con búsqueda y
  paginación; hover card con teléfono/email/web desde el tab de stock.

---

## Fase 5 ⬜ — Integración ARCA (ex-AFIP) — solo esquema preparado (DEC-006)

- [ ] Cola BullMQ + Redis para comprobantes asíncronos.
- [ ] Cliente WSAA/WSFE (requiere credenciales reales del negocio).
- [ ] Worker: `PENDING` → solicitud de CAE → update `invoices`.
- [ ] Frontend: acción "facturar" → encolar.
