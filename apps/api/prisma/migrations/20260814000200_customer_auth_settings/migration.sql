ALTER TABLE "Customer" ALTER COLUMN "phone" DROP NOT NULL;
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

CREATE TABLE "CustomerAuthSetting" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "mode" TEXT NOT NULL DEFAULT 'phone',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAuthSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CustomerAuthSetting" ("id", "mode", "updatedAt") VALUES (1, 'phone', CURRENT_TIMESTAMP);
