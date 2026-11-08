# Decisiones Arquitectónicas (ADRs ligeros)

Registro de decisiones técnicas y el porqué de cada una. Nuevas decisiones se agregan al final.

---

## DEC-001 · Stack: Express 5 + TypeScript + Prisma

**Fecha:** 2026-10-30

**Decisión:** Express sobre NestJS; Prisma como ORM.

**Porqué:**
- Express: equipo más liviano, estructura libre, menboilerplate mínimo. La modularidad
  (routes → service → Prisma) se impone internamente y cumple los mismos niveles de SOLID.
- Prisma: schema declarativo versionado en Git, migraciones reproducibles y client
  tipado que marca la capa de acceso a datos declarativa sin SQL manual para los casos comunes.

**Alternativas descartadas:** NestJS (más acoplado a su own DI, costo mayor para el equipo), Drizzle, TypeORM.

---

## DEC-002 · Docker Compose en puerto PostgreSQL 5433 en host ( sharing-safe)

**Fecha:** 2026-10-30

**Decisión:** `docker-compose.yml` mapea Postgres a `5433:5432` en vez del clásico `5432`.

**Porqué:** la máquina de desarrollo ya tiene un PostgreSQL nativo 17.11 (EnterpriseDB, servicio
launchd) ocupando el puerto 5432. Mapear al 5433 permite coexistir ambos servicios y evita
configurar el docker-compose sobre el localhost nativo que puede cambiar.

Redis queda en el 6379 estándar (nada lo ocupa).

---

## DEC-003 · `ticketId` FK externa sin autoincremental

**Fecha:** 2026-10-31

**Decisión:** `tickets.ticket_id` es `BigInt` **sin default**; toda creación de ticket vía API
la pasa explícita (`POST /api/tickets` la exige).

**Porqué:**
1. Los tickets realmente nacen en GLPI e importados con su id real (ej. `125691`), igual que en la especificación.
2. Prisma no soporta `autoincrement()` sobre `BigInt` (solo `Int`): el client exige el argumento explícito armado aparte o agéndalo. Probar `@default(autoincrement())` + migración aplicada se descartó (revertido con `revert_ticket_default`).

**Consecuencias:**
- Crear un ticket interno sin GLPI no es posible vía API (insertar física SQL a la BD automáticos y usa SQL/Studio).
- `invoices.ticket_id` mantenido aca си de FK acá luego del uso.

---

## DEC-004 · Serialización JSON de BigInt/Decimal

**Fecha:** 2026-10-31

**Decisión:** `src/shared/json-bigint.ts` extiende `BigInt.prototype.toJSON` para serializar
como string; `Prisma.Decimal` ya serializa por defecto como string vía decimal.js.

**Porqué:** `JSON.stringify` lanza `TypeError` con BigInt por defecto. Serializar como string
evita pérdida de precisión en ids grandes (los BigInt son ids de tickets GLPI) sin sobrescribir
respuestas; el frontend las referencia respetando el tipo string.

---

## DEC-005 · Validación con Zod + error handler global

**Fecha:** 2026-10-31

**Decisión:** los services/routs validan con Zod (`schema.parse`) y Express 5 propaga los errores
a `src/shared/error-handler.ts`, que mapea: `ZodError → 400`, `HttpError → su status`,
`P2002 → 409`, JSON malformado → `400`, resto → `500`.

**Porqué:** un único lugar de la cadena de errores evita try/catch repetidos y deja los
routes/services enfocados en el caso feliz. Express 5 ya captura promises rechazadas en handlers async.

---

## DEC-006 · ARCA diferido a Fase 5 (solo esquema preparado)

**Fecha:** 2026-10-30

**Decisión:** la tabla `invoices` existe desde la migración inicial, pero no hay ni cola (BullMQ),
ni credenciales, ni worker ARCA hasta la Fase 5.

**Porqué:** el issuing con ARCA depende de certificaciones WSAA/WSFE (credenciales reales workflow)
que aún no expone el negocio; modelar la tabla early evita migraciones destructivas futuras.
