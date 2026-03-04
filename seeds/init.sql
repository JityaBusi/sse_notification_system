CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

INSERT INTO users (id, name) VALUES
(1, 'User One'),
(2, 'User Two')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    channel VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_channel_id
ON events(channel, id);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id INTEGER NOT NULL,
    channel VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, channel),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO user_subscriptions (user_id, channel)
VALUES (1, 'alerts')
ON CONFLICT DO NOTHING;