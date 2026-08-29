-- Administrator email is optional. PostgreSQL unique indexes allow multiple NULL values,
-- so the existing unique index can remain while empty emails are stored as NULL.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
