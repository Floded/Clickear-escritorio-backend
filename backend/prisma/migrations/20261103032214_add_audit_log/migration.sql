-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "resource" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
