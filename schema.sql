-- Legal Change Letter MVP
-- Apply to a separate D1 database; do not reuse the subsidy-letter database.

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  terms_checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER REFERENCES sources(id),
  external_id TEXT,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TEXT,
  effective_date TEXT,
  law_id TEXT,
  law_number TEXT,
  law_type TEXT,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  category TEXT,
  content_hash TEXT NOT NULL UNIQUE,
  raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'detected',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id INTEGER NOT NULL REFERENCES updates(id),
  plain_summary TEXT,
  change_details TEXT,
  effective_date TEXT,
  affected_people TEXT,
  required_action TEXT,
  official_source_url TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'needs_review',
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(update_id)
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  confirmed INTEGER NOT NULL DEFAULT 0,
  categories_json TEXT NOT NULL DEFAULT '[]',
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sent_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id),
  article_id INTEGER NOT NULL REFERENCES articles(id),
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subscriber_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_updates_status_detected ON updates(status, detected_at);
CREATE INDEX IF NOT EXISTS idx_articles_review_status ON articles(review_status, created_at);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirmed ON subscribers(confirmed, unsubscribed_at);
