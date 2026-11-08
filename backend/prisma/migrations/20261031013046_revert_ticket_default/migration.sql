-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "ticket_id" DROP DEFAULT;
DROP SEQUENCE "tickets_ticket_id_seq";
