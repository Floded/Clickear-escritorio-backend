-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "assigned_employee_id" INTEGER;

-- CreateTable
CREATE TABLE "ticket_assignments" (
    "id" SERIAL NOT NULL,
    "ticket_id" BIGINT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP,

    CONSTRAINT "ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_assignments_ticket_id_idx" ON "ticket_assignments"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_assignments_employee_id_idx" ON "ticket_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "tickets_assigned_employee_id_idx" ON "tickets"("assigned_employee_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("ticket_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
