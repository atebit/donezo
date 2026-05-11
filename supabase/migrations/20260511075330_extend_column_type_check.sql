-- Epic 07 / Slice S0: extend column.type check constraint to include the 7 additional
-- cell types required by the column registry:
--   email, phone, country, vote, week, location, formula
-- Brings the total from 17 → 24 allowed type values.
--
-- The inline check was named `column_type_check` by Postgres (inline constraints without
-- an explicit CONSTRAINT clause get auto-named as <table>_<column>_check).

alter table public."column" drop constraint if exists column_type_check;

alter table public."column" add constraint column_type_check check (type in (
  'text', 'long_text', 'status', 'priority', 'person',
  'date', 'timeline', 'number', 'currency', 'checkbox',
  'file', 'link', 'tags', 'rating',
  'email', 'phone', 'country', 'vote', 'week', 'location',
  'updated_by', 'created_by', 'created_at_col', 'formula'
));
