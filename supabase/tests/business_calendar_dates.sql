-- Run after 20260916220000_preserve_business_calendar_dates.sql in a test DB.
-- This test rolls back all fixtures. Never changes historical document dates.
BEGIN;
CREATE TEMP TABLE calendar_timestamp_fixture (
  movement_date timestamptz,
  created_at timestamptz
);
CREATE TRIGGER preserve_selected_timestamp BEFORE INSERT ON calendar_timestamp_fixture
FOR EACH ROW EXECUTE FUNCTION public.normalize_inventory_movement_timestamp();
DO $$
DECLARE
  zone text;
  selected_date date := '2026-09-11';
  instant timestamptz := '2026-10-01T01:30:00Z';
  expected date := (instant AT TIME ZONE public.business_timezone())::date;
  actual record;
BEGIN
  FOREACH zone IN ARRAY ARRAY['UTC','America/Santiago','Asia/Tokyo','Pacific/Kiritimati'] LOOP
    PERFORM set_config('TimeZone', zone, true);
    IF selected_date::text <> '2026-09-11' THEN RAISE EXCEPTION 'Document date changed'; END IF;
    IF public.business_date(instant) <> expected THEN RAISE EXCEPTION 'Business date depends on session timezone'; END IF;
    IF public.business_today() <> (CURRENT_TIMESTAMP AT TIME ZONE public.business_timezone())::date THEN
      RAISE EXCEPTION 'Business today differs from company date';
    END IF;
    TRUNCATE calendar_timestamp_fixture;
    INSERT INTO calendar_timestamp_fixture VALUES (instant, NULL);
    SELECT * INTO actual FROM calendar_timestamp_fixture;
    IF actual.movement_date <> instant OR actual.created_at IS NULL THEN
      RAISE EXCEPTION 'Inventory trigger changed the chosen instant';
    END IF;
  END LOOP;
END $$;
ROLLBACK;
