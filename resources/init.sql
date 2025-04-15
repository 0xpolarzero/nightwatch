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

-- Type for the overall author bio structure
CREATE TYPE author_bio_type AS (
    description TEXT,
    user_mentions mention_type[],
    urls url_type[]
);

-- Table: authors
CREATE TABLE authors (
    id BIGINT PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    profile_picture_url TEXT NOT NULL,
    followers INTEGER NOT NULL,
    following INTEGER NOT NULL,
    profile_bio author_bio_type NOT NULL
);

-- Table: tweets
CREATE TABLE tweets (
    id BIGINT PRIMARY KEY,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    author_id BIGINT NOT NULL REFERENCES authors(id),
    conversation_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    user_mentions mention_type[],
    urls url_type[],
    medias media_type[],
    CONSTRAINT fk_author FOREIGN KEY(author_id) REFERENCES authors(id)
);

-- tweets indexes
CREATE INDEX idx_tweets_conversation_id ON tweets(conversation_id);
CREATE INDEX idx_tweets_text_gin ON tweets USING GIN (text);