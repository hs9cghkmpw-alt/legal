-- Back up D1 first. Apply once only to a database using the old schema.
ALTER TABLE subscribers ADD COLUMN unsubscribe_token TEXT;
ALTER TABLE subscribers ADD COLUMN consent_at TEXT;
ALTER TABLE subscribers ADD COLUMN consent_version TEXT NOT NULL DEFAULT 'draft-1';
UPDATE subscribers SET unsubscribe_token=lower(hex(randomblob(16))) WHERE unsubscribe_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_unsubscribe_token ON subscribers(unsubscribe_token);
CREATE TABLE IF NOT EXISTS rate_limits(rate_key TEXT NOT NULL,window_start TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(rate_key,window_start));
CREATE TABLE IF NOT EXISTS delivery_runs(id INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL UNIQUE,status TEXT NOT NULL CHECK(status IN ('queued','completed','partial_failure')),queued_count INTEGER NOT NULL DEFAULT 0,skipped_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS delivery_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL REFERENCES delivery_runs(run_id),subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,article_ids TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT,sent_at TEXT,last_error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(run_id,subscriber_id));
CREATE TABLE IF NOT EXISTS system_locks(lock_name TEXT PRIMARY KEY,lock_token TEXT,lock_until TEXT);
INSERT OR IGNORE INTO system_locks(lock_name) VALUES('delivery');
CREATE INDEX IF NOT EXISTS idx_delivery_queue_pending ON delivery_queue(status,next_attempt_at,id);
