-- AlterTable
CREATE SEQUENCE tickets_ticket_id_seq;
ALTER TABLE "tickets" ALTER COLUMN "ticket_id" SET DEFAULT nextval('tickets_ticket_id_seq');
ALTER SEQUENCE tickets_ticket_id_seq OWNED BY "tickets"."ticket_id";
