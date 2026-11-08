-- DropForeignKey
ALTER TABLE "establishments" DROP CONSTRAINT "establishments_dispatch_order_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_establishment_cue_fkey";

-- AddForeignKey
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_dispatch_order_id_fkey" FOREIGN KEY ("dispatch_order_id") REFERENCES "dispatch_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_establishment_cue_fkey" FOREIGN KEY ("establishment_cue") REFERENCES "establishments"("cue") ON DELETE RESTRICT ON UPDATE CASCADE;
