-- init_timescale_test.sql
-- TimescaleDB quick test script for manual use
-- Usage (example):
-- 1) Using docker exec into your container:
--   docker exec -i <컨테이너 이름> psql -U admin -d panopticon -f /dev/stdin < init_timescale_test.sql
-- 2) Or from host with psql (if PGPASSWORD set):
--  PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d panopticon -f init_timescale_test.sql
--
-- This file is idempotent: it uses IF NOT EXISTS where appropriate.

-- 1) Create the extension (needed once)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2) Create a test table for time-series data
CREATE TABLE IF NOT EXISTS test_metrics (
  time        TIMESTAMPTZ NOT NULL,
  device_id   TEXT NOT NULL,
  value       DOUBLE PRECISION,
  meta        JSONB DEFAULT '{}'::jsonb
);

-- 3) Convert to hypertable (safe to call multiple times)
SELECT create_hypertable('test_metrics', 'time', if_not_exists => TRUE);

-- 4) Optional: create an index to speed queries by device
CREATE INDEX IF NOT EXISTS idx_test_metrics_device_time ON test_metrics (device_id, time DESC);

-- 5) Insert sample data (a few rows)
INSERT INTO test_metrics (time, device_id, value, meta) VALUES
  (now() - interval '5 minutes', 'dev-A', 12.3, '{"loc":"room1"}'),
  (now() - interval '4 minutes', 'dev-A', 13.1, '{"loc":"room1"}'),
  (now() - interval '3 minutes', 'dev-B', 7.8,  '{"loc":"room2"}'),
  (now() - interval '2 minutes', 'dev-A', 11.7, '{"loc":"room1"}'),
  (now() - interval '1 minute',  'dev-B', 8.2,  '{"loc":"room2"}'),
  (now(),                         'dev-A', 12.9, '{"loc":"room1"}');

-- 6) Basic sanity check: show rows
-- Run this interactively after the file runs or include here to get output when executed with -f
SELECT time, device_id, value, meta FROM test_metrics ORDER BY time DESC LIMIT 10;

-- 7) Aggregation example: 1-minute buckets per device
SELECT
  time_bucket('1 minute', time) AS minute,
  device_id,
  round(avg(value)::numeric, 3) AS avg_value,
  count(*) AS samples
FROM test_metrics
GROUP BY minute, device_id
ORDER BY minute DESC, device_id;

-- 8) Rolling average example (3-row window per device)
SELECT time, device_id, value,
  round(avg(value) OVER (PARTITION BY device_id ORDER BY time ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)::numeric, 3) AS rolling_avg_3
FROM test_metrics
ORDER BY time ASC
LIMIT 50;

-- 9) Show hypertable metadata
SELECT * FROM timescaledb_information.hypertables;

-- 10) Cleanup commands (commented out) — run manually if you want to remove test data
TRUNCATE test_metrics;
DROP TABLE test_metrics;

-- End of file
