ALTER TABLE "attendance_records" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "longitude" double precision;--> statement-breakpoint

-- Repair existing task names from the WorkGuru task line item id.
UPDATE "attendance_records"
SET "workguru_task_id" = NULLIF(BTRIM("raw_payload"->>'taskLineItemId'), '')
WHERE "workguru_task_id" IS NULL
  AND "raw_payload" ? 'taskLineItemId'
  AND NULLIF(BTRIM("raw_payload"->>'taskLineItemId'), '') IS NOT NULL;--> statement-breakpoint

UPDATE "attendance_records" AS ar
SET "task_id" = t."id",
    "task_name" = t."name"
FROM "tasks" AS t
WHERE t."workguru_id" = COALESCE(ar."workguru_task_id", ar."raw_payload"->>'taskLineItemId')
  AND (ar."task_name" IS NULL OR BTRIM(ar."task_name") = '');--> statement-breakpoint

-- Keep the API-provided name when the task no longer exists locally.
UPDATE "attendance_records" AS ar
SET "task_name" = NULLIF(BTRIM(ar."raw_payload"->'taskLineItem'->>'name'), '')
WHERE (ar."task_name" IS NULL OR BTRIM(ar."task_name") = '')
  AND NULLIF(BTRIM(ar."raw_payload"->'taskLineItem'->>'name'), '') IS NOT NULL;--> statement-breakpoint

-- Only import coordinates explicitly returned by WorkGuru, and only if valid.
UPDATE "attendance_records"
SET "latitude" = ("raw_payload"->>'latitude')::double precision,
    "longitude" = ("raw_payload"->>'longitude')::double precision
WHERE "raw_payload" ? 'latitude'
  AND "raw_payload" ? 'longitude'
  AND ("raw_payload"->>'latitude') ~ '^-?[0-9]+([.][0-9]+)?$'
  AND ("raw_payload"->>'longitude') ~ '^-?[0-9]+([.][0-9]+)?$'
  AND ("raw_payload"->>'latitude')::double precision BETWEEN -90 AND 90
  AND ("raw_payload"->>'longitude')::double precision BETWEEN -180 AND 180
  AND NOT (
    abs(("raw_payload"->>'latitude')::double precision) < 0.000001
    AND abs(("raw_payload"->>'longitude')::double precision) < 0.000001
  );
