ALTER TABLE inbox_items
  ADD COLUMN IF NOT EXISTS generated_comment text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS saved_at timestamptz;