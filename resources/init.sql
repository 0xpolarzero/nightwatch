-- Enable necessary extensions for advanced GIN indexing like trigrams for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Type for a single URL entity
CREATE TYPE url_type AS (
    display_url TEXT,
    expanded_url TEXT,
    start_index INTEGER,
    end_index INTEGER
);

-- Type for a single mention entity
CREATE TYPE mention_type AS (
    username TEXT,
    start_index INTEGER,
    end_index INTEGER
);

-- Type for a single media entity
CREATE TYPE media_type AS (
    url TEXT,
    type TEXT,
    width INTEGER,
    height INTEGER,
    start_index INTEGER,
    end_index INTEGER
);

/* --------------------------------- TWITTER -------------------------------- */
-- Type for the overall author bio structure
CREATE TYPE user_bio_type AS (
    description TEXT,
    user_mentions mention_type[],
    url_mentions url_type[],
    urls url_type[]
);

-- Table: tw_users
CREATE TABLE tw_users (
    id BIGINT PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    profile_picture_url TEXT NOT NULL,
    followers INTEGER NOT NULL,
    following INTEGER NOT NULL,
    profile_bio user_bio_type NOT NULL
);

-- Table: tw_posts
CREATE TABLE IF NOT EXISTS tw_posts (
    id BIGINT PRIMARY KEY,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    user_id BIGINT NOT NULL REFERENCES tw_users(id) ON DELETE CASCADE,
    conversation_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    user_mentions mention_type[],
    urls url_type[],
    medias media_type[],
    fts_tokens tsvector
);

-- tw_posts indexes
CREATE INDEX IF NOT EXISTS idx_tw_posts_user_id ON tw_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_tw_posts_conversation_id ON tw_posts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tw_posts_text_gin ON tw_posts USING GIN (text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tw_posts_fts_tokens ON tw_posts USING GIN (fts_tokens);

-- Trigger function to auto-update tw_posts.fts_tokens
CREATE OR REPLACE FUNCTION tw_posts_fts_trigger() RETURNS trigger AS $$
begin
  new.fts_tokens := to_tsvector('english', COALESCE(new.text, ''));
  return new;
end
$$ LANGUAGE plpgsql;

-- Trigger definition for tw_posts
DROP TRIGGER IF EXISTS tsvectorupdate_tw_posts ON tw_posts;
CREATE TRIGGER tsvectorupdate_tw_posts BEFORE INSERT OR UPDATE
ON tw_posts FOR EACH ROW EXECUTE FUNCTION tw_posts_fts_trigger();

/* --------------------------------- TELEGRAM -------------------------------- */
-- Table: tg_channels
CREATE TABLE IF NOT EXISTS tg_channels (
    id BIGINT PRIMARY KEY,
    title TEXT NOT NULL,
    about TEXT NOT NULL,
    channel_username TEXT NOT NULL, -- usernames[0]
    admin_usernames TEXT[] NOT NULL -- usernames[1, 2, ...]
);

-- Table: tg_messages
CREATE TABLE IF NOT EXISTS tg_messages (
    id TEXT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    message TEXT NOT NULL,
    url TEXT NOT NULL, -- t.me/<channel_name>/<message_id>
    channel_id BIGINT NOT NULL REFERENCES tg_channels(id) ON DELETE CASCADE,
    reply_to_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    views INTEGER,
    urls url_type[], -- entities with className "MessageEntityTextUrl" -> offset, length, url
    has_media BOOLEAN NOT NULL, -- if we want to show images we can create an api route for downloading them with the telegram client, and cache them
    fts_tokens tsvector,
    thread_id TEXT, -- Stores the composite ID (channel_id-message_id) of the root message in the thread
    CONSTRAINT uq_tg_messages_channel_message UNIQUE (channel_id, message_id),
    CONSTRAINT fk_reply_to_message FOREIGN KEY (channel_id, reply_to_message_id)
        REFERENCES tg_messages(channel_id, message_id) ON DELETE SET NULL
);

-- tg_messages indexes
CREATE INDEX IF NOT EXISTS idx_tg_messages_channel_id ON tg_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_tg_messages_channel_reply_to ON tg_messages(channel_id, reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tg_messages_fts_tokens ON tg_messages USING GIN (fts_tokens);
CREATE INDEX IF NOT EXISTS idx_tg_messages_channel_message_date ON tg_messages(channel_id, message_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tg_messages_thread_id ON tg_messages(thread_id);

-- Trigger function to auto-update tg_messages.fts_tokens
CREATE OR REPLACE FUNCTION tg_messages_fts_trigger() RETURNS trigger AS $$
begin
  new.fts_tokens := to_tsvector('english', COALESCE(new.message, ''));
  return new;
end
$$ LANGUAGE plpgsql;

-- Trigger definition for tg_messages
DROP TRIGGER IF EXISTS tsvectorupdate_tg_messages ON tg_messages;
CREATE TRIGGER tsvectorupdate_tg_messages BEFORE INSERT OR UPDATE
ON tg_messages FOR EACH ROW EXECUTE FUNCTION tg_messages_fts_trigger();
