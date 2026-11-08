# API — Catálogo de Endpoints

Base URL: `http://localhost:3000`

Todas las rutas (salvo `GET /`, `GET /api/health` y `POST /api/auth/*`) viven bajo `/api` y **requieren sesión** (ver [Autenticación](#autenticación)).

---

## Convenciones generales

### Paginación

Todos los listados aceptan `page` (default `1`) y `limit` (default `20`, máx `100`) y responden:

```json
{
  "data": [ ... ],
  "page": 1,
  "limit": 20,
  "total": 2,
  "totalPages": 1
}
```

### Serialización

- `BigInt` (ej. `ticketId`) → se devuelve como **string**: `"125691"`
- `Decimal` (ej. `distanceKm`, `amount`) → se devuelve como **string**: `"31.3"`
- Fechas → ISO 8601: `"2026-10-05T11:52:03.000Z"`

### Códigos de error

| Código | Causa | Ejemplo |
|---|---|---|
| `400` | Body JSON malformado | `{"error":"JSON invalido en el cuerpo de la peticion"}` |
| `400` | Validación Zod | `{"error":"Datos invalidos","details":[{"field":"status","message":"Invalid enum value..."}]}` |
| `404` | Recurso inexistente | `{"error":"Ticket 999999 not found"}` |
| `401` | Sin sesión o credenciales inválidas | `{"error":"Credenciales incorrectas"}` |
| `409` | Clave única duplicada | `{"error":"Valor duplicado","field":["cue"]}` |
| `500` | Error no controlado | `{"error":"Error interno del servidor"}` |

### Catálogos de valores

- Estado de ticket: `ABIERTO` | `EN PROGRESO` | `TERMINADO`
- Estado de factura (Fase 5): `PENDING` | `APPROVED` | `REJECTED`

> `ticketId` es la PK externa de GLPI y **va explícito en la creación** (no es autoincremental).

---

## Sistema

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Ping general |
| `GET` | `/api/health` | Health check |

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

---

## Autenticación

La sesión se maneja con un **JWT en cookie `httpOnly`** (7 días, `SameSite=Lax`). No hay header `Authorization`: el backend lee la cookie automáticamente y las respuestas con credenciales usan `credentials: true` en CORS.

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Inicia sesión y setea la cookie de sesión |
| `POST` | `/api/auth/logout` | Borra la cookie de sesión |
| `GET` | `/api/auth/me` | Devuelve el usuario de la sesión actual |

```bash
# Login (ok -> {"user":{...}} + Set-Cookie: auth_token=...; HttpOnly; SameSite=Lax)
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@clickear.local","password":"..."}'

# Sesión actual (401 si no hay cookie válida)
curl -b cookies.txt http://localhost:3000/api/auth/me

# Logout
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/logout
```

Errores: `400` si el body no valida, `401` con mensaje genérico `"Credenciales incorrectas"` si el email o la contraseña no coinciden (no se distingue cuál falló).

El usuario inicial se crea con `npm run db:seed` usando `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env`.

---

## Establecimientos (`/api/establishments`)

### `GET /api/establishments` — listado paginado con filtros

Query params opcionales: `search` (CUE o nombre), `department`, `locality`, `dispatchOrderId`, `page`, `limit`.

```bash
curl "http://localhost:3000/api/establishments?search=25%20de&limit=10"
```

### `GET /api/establishments/:cue` — detalle con orden asociada

```bash
curl http://localhost:3000/api/establishments/700083300
```

Responde el establecimiento + `dispatchOrder` con técnicos de la orden (o `dispatchOrder: null`).

### `POST /api/establishments` — alta

```bash
curl -X POST http://localhost:3000/api/establishments \
  -H "Content-Type: application/json" \
  -d '{
    "cue": "700083300",
    "name": "EP 25 DE MAYO",
    "department": "25 DE MAYO",
    "locality": "LOCALIDAD A",
    "address": "LA PLATA ENTRE CALLE 5 Y 6",
    "distanceKm": 31.30
  }'
```

- `cue` y `name` obligatorios; resto opcional → `201 Created`
- CUE duplicado → `409`

### `PATCH /api/establishments/:cue` — modificación parcial

Solo campos enviados. Ejemplo:

```bash
curl -X PATCH http://localhost:3000/api/establishments/700083300 \
  -H "Content-Type: application/json" \
  -d '{"directorName": "María González"}'
```

### `DELETE /api/establishments/:cue` — baja

Elimina en cascada los tickets del establecimiento (definido en schema). Devuelve `204 No Content`.

---

## Órdenes de Despacho (`/api/dispatch-orders`)

### `GET /api/dispatch-orders` — listado

Filtros: `listStatus`, `dispatchCode` (parcial, insensible), `page`, `limit`.
Cada orden incluye establecimientos y técnicos vinculados.

```bash
curl "http://localhost:3000/api/dispatch-orders?listStatus=INICIADA"
```

### `GET /api/dispatch-orders/:id` — detalle

Incluye `establishments[]` y `technicians[]`. Inexistente → `404`.

### `POST /api/dispatch-orders` — alta (transacción atómica)

Crea la orden, vincula técnicos (tabla N:M) y asigna establecimientos **en una sola transacción**: si falla algo, no queda nada creado.

```bash
curl -X POST http://localhost:3000/api/dispatch-orders \
  -H "Content-Type: application/json" \
  -d '{
    "dispatchCode": "CC0271",
    "dispatchTimestamp": "2026-10-05T11:52:03Z",
    "listStatus": "INICIADA",
    "technicianIds": [1, 2],
    "establishmentCues": ["700083300"]
  }'
```

- `technicianIds` y `establishmentCues` opcionales (default `[]`)
- CUE o técnico inexistente → `404` sin parcialidades
- Un establecimiento ya asignado queda **re-asignado** a esta orden (FK singular)

---

## Técnicos (`/api/technicians`)

| Método | Descripción | Body |
|---|---|---|
| `GET` | Listado paginado, filtro `search` por nombre | — |
| `POST` | Alta | `{"fullName": "Juan Perez"}` → `201` |

---

## Tickets (`/api/tickets`)

### `GET /api/tickets` — listado con filtros

| Filtro | Descripción |
|---|---|
| `status` | `ABIERTO` \| `EN PROGRESO` \| `TERMINADO` |
| `establishment` | CUE exacto |
| `technicianId` | Tickets de establecimientos que pertenecen a órdenes donde participa ese técnico |
| `search` | Búsqueda parcial en `title` (case-insensitive) |

```bash
curl "http://localhost:3000/api/tickets?technicianId=1&search=impresora"
```

Cada ticket incluye un resumen del establecimiento (`cue`, `name`, `department`, `locality`, `isSecondaryBuilding`).

### `GET /api/tickets/:id` — detalle completo

Árbol de datos: ticket → establecimiento → orden de despacho → técnicos, más facturas asociadas (Fase 5):

```bash
curl http://localhost:3000/api/tickets/125691 | python3 -m json.tool
```

Nuevo `ticketId` inexistente en el listado → `404`.

### `POST /api/tickets` — alta

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": 125691,
    "establishmentCue": "700083300",
    "title": "Detalle o requerimiento del ticket",
    "glpiClosedTicket": "REF-GLPI-001",
    "openingTimestamp": "2026-10-05T09:00:00Z"
  }'
```

- `ticketId` y `title` obligatorios (id viene del ticket en línea)
- `status` default `ABIERTO`; `establishmentCue` opcional (ticket genérico sin establecimiento)
- CUE inexistente → `404`

### `PATCH /api/tickets/:id/status` — cambio de estado

```bash
curl -X PATCH http://localhost:3000/api/tickets/125691/status \
  -H "Content-Type: application/json" \
  -d '{"status": "EN PROGRESO"}'
```

---

## Proveedores (`/api/suppliers`)

| Método | Descripción | Body |
|---|---|---|
| `GET` | Listado paginado, filtro `search` (nombre o email). Incluye `_count.inventoryItems` | — |
| `GET /:id` | Detalle con `inventoryItems` asociadas | — |
| `POST` | Alta | `{"name": "Distribuidora Sur", "contactPhone": "221-555-1234", "contactEmail": "ventas@dsur.com.ar", "website": "https://dsur.com.ar"}` → `201` |
| `PATCH /:id` | Modificación parcial (mismos campos, todos opcionales) | parcial del alta |
| `DELETE /:id` | Baja (`204`). Los ítems asociados quedan sin proveedor (`SET NULL`) | — |

`contactEmail` debe ser un email válido y `website` una URL válida (validación Zod).

## Empleados (`/api/employees`)

| Método | Descripción | Body |
|---|---|---|
| `GET` | Listado paginado, filtros `search` y `isActive` | — |
| `GET /:id` | Detalle | — |
| `POST` | Alta | `{"fullName": "María González", "dniOrFileNumber": "12345678", "phone": "…", "isActive": true}` → `201` |
| `PATCH /:id` | Modificación parcial | parcial del alta |
| `DELETE /:id` | Baja lógica (`isActive: false`); `409` si tiene historial de asignaciones | — |
| `GET /:id/assignments` | Stock en custodia: `unitsInCustody` + asignaciones (activas y devueltas) | — |

## Ítems de Inventario (`/api/inventory-items`)

| Método | Descripción | Body |
|---|---|---|
| `GET` | Listado paginado, filtros `search`, `supplierId`, `hasStock`. Incluye `supplier` y `_count.assignments` | — |
| `GET /:id` | Detalle | — |
| `POST` | Alta | `{"name": "Cable HDMI 2m", "description": "…", "supplierId": 1, "availableQuantity": 10}` → `201` |
| `PATCH /:id` | Modificación parcial (no toca `availableQuantity`) | parcial del alta |
| `DELETE /:id` | Baja (`409` si tiene asignaciones) | — |
| `PATCH /:id/stock` | Ajuste diferencial de stock (entero, negativo para merma) | `{"quantity": -3}` |

## Asignaciones (`/api/assignments`)

| Método | Descripción | Body |
|---|---|---|
| `GET` | Listado paginado, filtros `status` (`ACTIVE`/`RETURNED`), `employeeId`, `inventoryItemId` | — |
| `POST` | Asignación transaccional (`409` si no hay stock suficiente) | `{"inventoryItemId": 1, "employeeId": 2, "quantityAssigned": 2, "deliveryDate": "2026-11-01", "notes": "…"}` → `201` |
| `PUT /:id/return` | Devolución total o parcial con re-stock atómico | `{"quantity": 1, "returnDate": "2026-11-05", "notes": "…"}` |

---

## Pendiente en el roadmap

- **Fase 5 (ARCA)**: cola BullMQ + worker que emite comprobantes y actualiza `invoices` (requiere credenciales WSAA/WSFE reales).
