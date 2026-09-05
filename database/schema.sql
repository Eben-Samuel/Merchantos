-- MERCHANTOS AI — Database Schema (PostgreSQL / SQLite compatible)

CREATE TABLE IF NOT EXISTS merchants (
    id              TEXT PRIMARY KEY DEFAULT 'default_merchant',
    name            TEXT NOT NULL,
    email           TEXT,
    timezone        TEXT DEFAULT 'Asia/Kolkata',
    currency        TEXT DEFAULT 'INR',
    created_at      TEXT DEFAULT (datetime('now'))
);