-- GovernXOne monitoring integration removed
ALTER TABLE "User" DROP COLUMN IF EXISTS "governxoneApiKey",
DROP COLUMN IF EXISTS "governxoneProjectId",
DROP COLUMN IF EXISTS "governxoneEndpoint";
