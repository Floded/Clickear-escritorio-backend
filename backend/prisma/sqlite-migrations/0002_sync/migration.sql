-- CreateTable
CREATE TABLE "pending_sync" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_budget_lines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "budget_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budget_lines_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budget_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_budget_lines" ("budget_id", "created_at", "description", "id", "inventory_item_id", "quantity", "subtotal", "unit_price") SELECT "budget_id", "created_at", "description", "id", "inventory_item_id", "quantity", "subtotal", "unit_price" FROM "budget_lines";
DROP TABLE "budget_lines";
ALTER TABLE "new_budget_lines" RENAME TO "budget_lines";
CREATE TABLE "new_dispatch_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dispatch_code" TEXT NOT NULL,
    "dispatch_timestamp" DATETIME NOT NULL,
    "list_status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_dispatch_orders" ("created_at", "dispatch_code", "dispatch_timestamp", "id", "list_status") SELECT "created_at", "dispatch_code", "dispatch_timestamp", "id", "list_status" FROM "dispatch_orders";
DROP TABLE "dispatch_orders";
ALTER TABLE "new_dispatch_orders" RENAME TO "dispatch_orders";
CREATE TABLE "new_employees" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "full_name" TEXT NOT NULL,
    "dni_or_file_number" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_employees" ("dni_or_file_number", "full_name", "id", "is_active", "phone") SELECT "dni_or_file_number", "full_name", "id", "is_active", "phone" FROM "employees";
DROP TABLE "employees";
ALTER TABLE "new_employees" RENAME TO "employees";
CREATE UNIQUE INDEX "employees_dni_or_file_number_key" ON "employees"("dni_or_file_number");
CREATE TABLE "new_establishments" (
    "cue" TEXT NOT NULL PRIMARY KEY,
    "dispatch_order_id" INTEGER,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "locality" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "distance_km" DECIMAL,
    "director_name" TEXT,
    "is_secondary_building" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "establishments_dispatch_order_id_fkey" FOREIGN KEY ("dispatch_order_id") REFERENCES "dispatch_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_establishments" ("address", "cue", "department", "director_name", "dispatch_order_id", "distance_km", "is_secondary_building", "locality", "name", "phone") SELECT "address", "cue", "department", "director_name", "dispatch_order_id", "distance_km", "is_secondary_building", "locality", "name", "phone" FROM "establishments";
DROP TABLE "establishments";
ALTER TABLE "new_establishments" RENAME TO "establishments";
CREATE TABLE "new_invoices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticket_id" BIGINT,
    "voucher_type" INTEGER NOT NULL,
    "doc_type" INTEGER NOT NULL,
    "doc_number" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "cae" TEXT,
    "cae_expiration_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("ticket_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_invoices" ("amount", "cae", "cae_expiration_date", "created_at", "doc_number", "doc_type", "error_message", "id", "status", "ticket_id", "voucher_type") SELECT "amount", "cae", "cae_expiration_date", "created_at", "doc_number", "doc_type", "error_message", "id", "status", "ticket_id", "voucher_type" FROM "invoices";
DROP TABLE "invoices";
ALTER TABLE "new_invoices" RENAME TO "invoices";
CREATE TABLE "new_item_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventory_item_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "quantity_assigned" INTEGER NOT NULL,
    "delivery_date" DATETIME NOT NULL,
    "return_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "item_assignments_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "item_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_item_assignments" ("created_at", "delivery_date", "employee_id", "id", "inventory_item_id", "notes", "quantity_assigned", "return_date") SELECT "created_at", "delivery_date", "employee_id", "id", "inventory_item_id", "notes", "quantity_assigned", "return_date" FROM "item_assignments";
DROP TABLE "item_assignments";
ALTER TABLE "new_item_assignments" RENAME TO "item_assignments";
CREATE TABLE "new_suppliers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "website" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_suppliers" ("contact_email", "contact_phone", "created_at", "id", "name", "website") SELECT "contact_email", "contact_phone", "created_at", "id", "name", "website" FROM "suppliers";
DROP TABLE "suppliers";
ALTER TABLE "new_suppliers" RENAME TO "suppliers";
CREATE TABLE "new_technicians" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "full_name" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_technicians" ("full_name", "id") SELECT "full_name", "id" FROM "technicians";
DROP TABLE "technicians";
ALTER TABLE "new_technicians" RENAME TO "technicians";
CREATE TABLE "new_ticket_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticket_id" BIGINT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "assigned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" DATETIME,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("ticket_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ticket_assignments" ("assigned_at", "employee_id", "id", "released_at", "ticket_id") SELECT "assigned_at", "employee_id", "id", "released_at", "ticket_id" FROM "ticket_assignments";
DROP TABLE "ticket_assignments";
ALTER TABLE "new_ticket_assignments" RENAME TO "ticket_assignments";
CREATE INDEX "ticket_assignments_ticket_id_idx" ON "ticket_assignments"("ticket_id");
CREATE INDEX "ticket_assignments_employee_id_idx" ON "ticket_assignments"("employee_id");
CREATE TABLE "new_tickets" (
    "ticket_id" BIGINT NOT NULL PRIMARY KEY,
    "establishment_cue" TEXT,
    "assigned_employee_id" INTEGER,
    "title" TEXT NOT NULL,
    "glpi_closed_ticket" TEXT,
    "opening_timestamp" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tickets_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_establishment_cue_fkey" FOREIGN KEY ("establishment_cue") REFERENCES "establishments" ("cue") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("assigned_employee_id", "establishment_cue", "glpi_closed_ticket", "opening_timestamp", "status", "ticket_id", "title") SELECT "assigned_employee_id", "establishment_cue", "glpi_closed_ticket", "opening_timestamp", "status", "ticket_id", "title" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
CREATE INDEX "tickets_assigned_employee_id_idx" ON "tickets"("assigned_employee_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

