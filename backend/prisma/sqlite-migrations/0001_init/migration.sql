-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "dispatch_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dispatch_code" TEXT NOT NULL,
    "dispatch_timestamp" DATETIME NOT NULL,
    "list_status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "establishments" (
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
    CONSTRAINT "establishments_dispatch_order_id_fkey" FOREIGN KEY ("dispatch_order_id") REFERENCES "dispatch_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "full_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "dispatch_technicians" (
    "dispatch_order_id" INTEGER NOT NULL,
    "technician_id" INTEGER NOT NULL,

    PRIMARY KEY ("dispatch_order_id", "technician_id"),
    CONSTRAINT "dispatch_technicians_dispatch_order_id_fkey" FOREIGN KEY ("dispatch_order_id") REFERENCES "dispatch_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dispatch_technicians_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tickets" (
    "ticket_id" BIGINT NOT NULL PRIMARY KEY,
    "establishment_cue" TEXT,
    "assigned_employee_id" INTEGER,
    "title" TEXT NOT NULL,
    "glpi_closed_ticket" TEXT,
    "opening_timestamp" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    CONSTRAINT "tickets_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_establishment_cue_fkey" FOREIGN KEY ("establishment_cue") REFERENCES "establishments" ("cue") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ticket_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticket_id" BIGINT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "assigned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" DATETIME,
    CONSTRAINT "ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("ticket_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "website" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "employees" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "full_name" TEXT NOT NULL,
    "dni_or_file_number" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplier_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "available_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "item_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventory_item_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "quantity_assigned" INTEGER NOT NULL,
    "delivery_date" DATETIME NOT NULL,
    "return_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "item_assignments_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "item_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
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
    CONSTRAINT "invoices_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("ticket_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "budget_code" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "establishment_cue" TEXT,
    "issue_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "total" DECIMAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budgets_establishment_cue_fkey" FOREIGN KEY ("establishment_cue") REFERENCES "establishments" ("cue") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "budget_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budget_lines_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budget_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "details" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tickets_assigned_employee_id_idx" ON "tickets"("assigned_employee_id");

-- CreateIndex
CREATE INDEX "ticket_assignments_ticket_id_idx" ON "ticket_assignments"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_assignments_employee_id_idx" ON "ticket_assignments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_dni_or_file_number_key" ON "employees"("dni_or_file_number");

