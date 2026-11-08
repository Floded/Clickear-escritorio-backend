# Roadmap de Desarrollo

> Fuente nativa de este checklist. El estado vivo y documentación detallada están en:
> - `docs/fases.md` (progreso con commits)
> - `docs/api.md` (endpoints)
> - `docs/decisiones.md` (ADRs)

> Estado de commits: Fases 1-2 **commiteadas**. Fase 3 **sin commit** (decisión puntual del usuario).

## 4. Lista de Tareas para el Desarrollo (Roadmap)

### Fase 1 ✅ Configuración Base e Infraestructura

- [x] Inicializar repositorio y entorno de desarrollo (Docker para Postgres y Redis). → Postgres 16 `:5433` + Redis 7 `:6379`, ambos con healthcheck.
- [x] Configurar ORM o Query Builder (ej. Prisma, TypeORM, Kysely o Drizzle) en el Backend. → Prisma 6.19.
- [x] Ejecutar scripts DDL de migraciones de PostgreSQL con las 9 tablas definidas. → Migración `init` (9 tablas + `dispatch_technicians` N:M).

### Fase 2 ✅ Backend - Módulo de Tickets y Despacho

- [x] Crear CRUD de Establecimientos (`establishments`). → + filtros por search/department/locality/orden.
- [x] Crear endpoints para carga y consulta de Órdenes de Despacho (`dispatch_orders`). → Alta transaccional: vincula técnicos N:M y asigna establecimientos de una sola pieza.
- [x] Crear API para listar Tickets con filtros por estado, establecimiento y técnico. → + búsqueda en título y paginación; alta y cambio de estado incluídos.
- [x] Crear endpoint de detalle de Ticket (`GET /api/tickets/:id`) que traiga todos los datos asociados. → establecimiento → orden → técnicos + facturas.

### Fase 3 ✅ Backend - Módulo de Inventario y Stock

- [x] Crear CRUD de Proveedores (`suppliers`) y Empleados (`employees`). → Empleados con baja lógica (`isActive`) y borrado físico bloqueado si tienen historial.
- [x] Crear CRUD de Ítems de Stock (`inventory_items`). → `availableQuantity` solo se mueve por transacciones/ajuste, updates no la tocan.
- [x] Implementar la transacción de asignación de stock a empleados (`POST /api/assignments`):
  - [x] Validar disponibilidad de stock en depósito. → Error `409` con detalle de disponible vs. solicitado.
  - [x] Registrar la entrega en `item_assignments` (con `delivery_date` obligatorio).
  - [x] Restar automáticamente de `available_quantity` de forma atómica. → `SELECT ... FOR UPDATE` + decrement en transacción; el CHECK de BD como 2ª barrera.
- [x] Endpoint para consultar el stock que tiene en custodia un empleado específico. → `GET /api/employees/:id/assignments` con `unitsInCustody` agregado.

**Extras de Fase 3** (no previstos en el roadmap):
- [x] Devolución total o parcial (`PUT /api/assignments/:id/return`) con re-stock atómico y trazabilidad de la devolución parcial.
- [x] Ajuste diferencial de stock (`PATCH /api/inventory-items/:id/stock`) para carga inicial, mermas y correcciones.
- [x] Listado global de asignaciones (`GET /api/assignments`) con filtro por estado (`ACTIVE`/`RETURNED`), empleado e ítem.

### Fase 4 ⬜ Frontend (Interfaz Web) — diferida por decisión de planificación

- [ ] Diseñar dashboard principal con navegación entre Tickets y Stock.
- [ ] Construir vista de lista de Tickets con buscador, filtros y tarjetas resumen.
- [ ] Implementar Modal / Vista detallada al seleccionar un Ticket.
- [ ] Diseñar panel de Control de Stock:
  - Tabla de ítems en depósito.
  - Formulario modal para asignar ítem a empleado.
  - Vista del "haber" del empleado (ítems bajo su responsabilidad).

### Fase 5 ⬜ Integración ARCA (ex-AFIP) — solo preparación por ahora (tabla `invoices` ya existe)

- [ ] Configurar servicio de cola (BullMQ/Redis) para el procesamiento asíncrono de comprobantes.
- [ ] Configurar cliente de integración con ARCA (vía biblioteca WebServices WSAA/WSFE o API wrapper).
- [ ] Crear Job Worker que tome comprobantes en estado `PENDING`, solicite CAE a ARCA y actualice `invoices`.
- [ ] Conectar la acción de facturar en el frontend con la cola de emisión.
