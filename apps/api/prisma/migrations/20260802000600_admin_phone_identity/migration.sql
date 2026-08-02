ALTER TABLE "User" ADD COLUMN "phone" TEXT;
WITH numbered AS (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn FROM "User") UPDATE "User" u SET "phone" = '+861380000' || lpad(numbered.rn::text, 4, '0') FROM numbered WHERE u."id" = numbered."id";
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_email_idx" ON "User"("email");
