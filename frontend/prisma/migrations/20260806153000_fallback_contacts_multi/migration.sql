-- Add multi-contact JSON column
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "fallbackContacts" JSONB;

-- Migrate legacy single contact into the array
UPDATE "Bot"
SET "fallbackContacts" = jsonb_build_array(
  jsonb_build_object(
    'type', "fallbackContactType"::text,
    'value', "fallbackContactValue"
  )
)
WHERE "fallbackContactType" IS NOT NULL
  AND "fallbackContactValue" IS NOT NULL
  AND ("fallbackContacts" IS NULL OR "fallbackContacts" = 'null'::jsonb);

-- Drop legacy columns
ALTER TABLE "Bot" DROP COLUMN IF EXISTS "fallbackContactType";
ALTER TABLE "Bot" DROP COLUMN IF EXISTS "fallbackContactValue";
