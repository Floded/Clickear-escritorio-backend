-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "budget_code" VARCHAR(20) NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "establishment_cue" VARCHAR(20),
    "issue_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" SERIAL NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_establishment_cue_fkey" FOREIGN KEY ("establishment_cue") REFERENCES "establishments"("cue") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
