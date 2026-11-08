-- CreateTable
CREATE TABLE "dispatch_orders" (
    "id" SERIAL NOT NULL,
    "dispatch_code" VARCHAR(50) NOT NULL,
    "dispatch_timestamp" TIMESTAMP(3) NOT NULL,
    "list_status" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "establishments" (
    "cue" VARCHAR(20) NOT NULL,
    "dispatch_order_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "department" VARCHAR(100),
    "locality" VARCHAR(100),
    "address" TEXT,
    "phone" VARCHAR(50),
    "distance_km" DECIMAL(6,2),
    "director_name" VARCHAR(255),
    "is_secondary_building" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "establishments_pkey" PRIMARY KEY ("cue")
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_technicians" (
    "dispatch_order_id" INTEGER NOT NULL,
    "technician_id" INTEGER NOT NULL,

    CONSTRAINT "dispatch_technicians_pkey" PRIMARY KEY ("dispatch_order_id","technician_id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "ticket_id" BIGINT NOT NULL,
    "establishment_cue" VARCHAR(20),
    "title" TEXT NOT NULL,
    "glpi_closed_ticket" VARCHAR(100),
    "opening_timestamp" TIMESTAMP,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ABIERTO',

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("ticket_id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contact_phone" VARCHAR(50),
    "contact_email" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "dni_or_file_number" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "available_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_assignments" (
    "id" SERIAL NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "quantity_assigned" INTEGER NOT NULL,
    "delivery_date" TIMESTAMP NOT NULL,
    "return_date" TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "ticket_id" BIGINT,
    "voucher_type" INTEGER NOT NULL,
    "doc_type" INTEGER NOT NULL,
    "doc_number" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cae" VARCHAR(50),
    "cae_expiration_date" DATE,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_dni_or_file_number_key" ON "employees"("dni_or_file_number");

-- AddForeignKey
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_dispatch_order_id_fkey" FOREIGN KEY ("dispatch_order_id") REFERENCES "dispatch_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_technicians" ADD CONSTRAINT "dispatch_technicians_dispatch_order_id_fkey" FOREIGN KEY ("dispatch_order_id") REFERENCES "dispatch_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_technicians" ADD CONSTRAINT "dispatch_technicians_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_establishment_cue_fkey" FOREIGN KEY ("establishment_cue") REFERENCES "establishments"("cue") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_assignments" ADD CONSTRAINT "item_assignments_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_assignments" ADD CONSTRAINT "item_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id") ON DELETE SET NULL ON UPDATE CASCADE;
