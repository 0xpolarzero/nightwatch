# Nightwatch

**A public archive of investigations into crypto scams and bad actors.**

![Nightwatch](./public/logo-white.png)

Nightwatch collects and preserves tweets and Telegram messages from trusted blockchain sleuths, turning volatile threads and conversations into a convenient searchable record.

A ledger of exposure. A watchful memory. A stain that won't fade.

## Table of Contents

- [Introduction](#introduction)
  - [Overview](#overview)
  - [Key Features](#key-features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Deployment](#deployment)
- [Architecture](#architecture)
  - [Data Flow](#data-flow)
  - [API Endpoints](#api-endpoints)
  - [Database Schema](#database-schema)
- [Technical Details](#technical-details)
  - [API Integration](#api-integration)
  - [Caching Strategy](#caching-strategy)
  - [Scheduled Jobs](#scheduled-jobs)
- [Contributing](#contributing)
- [License](#license)

## Introduction

### Overview

Nightwatch serves as a permanent archive for investigations conducted by trusted blockchain investigators like @zachxbt, sourced from both Twitter and Telegram.

The application indexes tweets and messages from selected accounts/channels, along with media attachments and metadata. It reconstructs Twitter conversation threads and Telegram reply chains to provide better context. This creates a reliable reference point to research potential scams and bad actors, with an easily searchable interface.

### Key Features

- **Permanent Archive**: Tweets and Telegram messages are stored in a database, ensuring they remain accessible even if deleted from the source platforms.
- **Full-Text Search**: Search through the entire archive using keywords across both platforms.
- **Conversation Context**: View entire Twitter threads and Telegram reply chains from relevant accounts/channels.
- **Media Preservation**: Images and videos attached to tweets are preserved and viewable..
- **Regular Updates**: Automatic synchronization with Twitter and Telegram to capture new content.

## Getting Started

### Prerequisites

- [Deno](https://deno.com/) (v1.37 or higher)
- [Node.js](https://nodejs.org/) (v20 or higher)
- [pnpm](https://pnpm.io/) (v8 or higher)
- A [Neon](https://neon.tech/) PostgreSQL database
- A [TwitterAPI.io](https://twitterapi.io/) API key
- Telegram API Credentials (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`)
- A Telegram User Session String (`TELEGRAM_SESSION`) generated with `pnpm telegram-login`

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/polareth/nightwatch.git
   cd nightwatch
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```
   NEON_DATABASE_URL=your_neon_postgres_connection_string
   TWITTERAPI_API_KEY=your_twitterapi_io_key
   CRON_SECRET=your_secret_for_cron_jobs
   TELEGRAM_API_ID=your_telegram_api_id
   TELEGRAM_API_HASH=your_telegram_api_hash
   TELEGRAM_SESSION=your_telegram_session_string # See Telegram section below
   ```

4. Generate a Telegram session string (if you don't have one):
   ```bash
   pnpm telegram-login
   ```
   Follow the prompts to log in with your Telegram account. The session string will be printed to the console. Add it to your environment variables (`TELEGRAM_SESSION`).

### Development

Run the development server:

```bash
pnpm dev
```

The application will be available at http://localhost:5173.

### Deployment

Nightwatch is designed to be deployed on [Deno Deploy](https://deno.com/deploy). The repository includes a GitHub Actions workflow for automatic deployment.

1. Build the application:

   ```bash
   pnpm build
   ```

2. Deploy manually (if not using GitHub Actions):
   ```bash
   pnpm deploy
   ```

## Architecture

### Data Flow

1.  **Data Collection**: Tweets from specified accounts are fetched from [TwitterAPI.io](https://twitterapi.io/). Messages from specified channels are fetched using [the Telegram API](https://core.telegram.org/api).
2.  **Data Processing**: Content is parsed and normalized, extracting mentions, URLs, media (Twitter), and reply structures.
3.  **Data Storage**: Processed content is stored in a [Neon](https://neon.tech/) database.
4.  **Data Retrieval**: Users query the database through the search interface via the `/api/search` endpoint.
5.  **Data Presentation**: Results are displayed with highlighting, conversation context, and media previews (Twitter) or indicators (Telegram).

### API Endpoints

- **`/api/search`**: Search for tweets and Telegram messages matching a query.
- **`/api/periodic-sync`**: Trigger a synchronization with Twitter and Telegram (protected by auth). Fetches new content since the last sync.
- **`/api/initial-sync`**: Perform initial backfill for specific Twitter users or Telegram channels (protected by auth).
- **`/api/health`**: Check the health of the application and its dependencies.

### Database Schema

The database uses four main tables:

1.  **`tw_users`**: Stores information about Twitter authors.

    - `id`: bigint (Twitter user ID)
    - `username`: text
    - `display_name`: text
    - `profile_picture_url`: text
    - `followers`: integer
    - `following`: integer
    - `profile_bio`: jsonb (bio, mentions, urls)

2.  **`tw_posts`**: Stores the tweets.

    - `id`: bigint (Tweet ID)
    - `url`: text
    - `text`: text
    - `user_id`: bigint (FK to `tw_users.id`)
    - `conversation_id`: bigint
    - `created_at`: timestamptz
    - `user_mentions`: jsonb (array of `DbMentionType`)
    - `urls`: jsonb (array of `DbUrlType`)
    - `medias`: jsonb (array of `DbMediaType`)
    - `fts_tokens`: tsvector (for full-text search)

3.  **`tg_channels`**: Stores information about Telegram channels.

    - `id`: bigint (Telegram channel ID)
    - `title`: text
    - `about`: text
    - `channel_username`: text
    - `admin_usernames`: text[]

4.  **`tg_messages`**: Stores Telegram messages.
    - `id`: text (Composite: `channel_id-message_id`)
    - `message_id`: bigint
    - `message`: text
    - `url`: text
    - `channel_id`: bigint (FK to `tg_channels.id`)
    - `reply_to_message_id`: bigint (Original message ID it replies to)
    - `created_at`: timestamptz
    - `urls`: jsonb (array of `DbUrlType`)
    - `has_media`: boolean
    - `thread_id`: text (ID of the root message in the reply chain)
    - `fts_tokens`: tsvector (for full-text search)

You can directly use [the reference SQL schema](./resources/init.sql) to create the database.

## Technical Details

### API Integration

- **Twitter**: Uses [TwitterAPI.io](https://twitterapi.io/) advanced search. Implements batch processing, cursor-based pagination, and differential updates (fetching only new tweets). See [`app/lib/sync.server.ts`](./app/lib/sync.server.ts#L69-L144).
- **Telegram**: Uses [`telejs`](https://github.com/gram-js/telejs) to connect directly to the Telegram API as a user. Fetches channel info and messages, performing differential updates based on the last stored message ID. Requires API credentials and a user session string. See [`app/lib/sync.server.ts`](./app/lib/sync.server.ts#L147-L233).

You can manually trigger syncs via the API endpoints:

```bash
# Periodic sync (fetches new content for all configured sources)
curl -X POST "http://localhost:5173/api/periodic-sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET"

# Initial sync (backfills specific sources)
# Twitter user:
curl -X POST "http://localhost:5173/api/initial-sync?twitter=zachxbt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET"

# Telegram channel:
curl -X POST "http://localhost:5173/api/initial-sync?telegram=some_channel_username" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET"

# Multiple sources:
curl -X POST "http://localhost:5173/api/initial-sync?twitter=userA,userB&telegram=channelA,channelB" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET"
```

You can customize the relevant users and channels in [`app/lib/constants.server.ts`](./app/lib/constants.server.ts) at `RELEVANT_SOURCES`. Same for the `BATCH_SIZE`.

### Caching Strategy

The application implements caching for search results to improve performance and reduce database load:

- **Search Results Caching**: `/api/search` results are cached for 1 hour.

You can customize the cache TTL in [`app/lib/constants.server.ts`](./app/lib/constants.server.ts) at `CACHE_TTL`.

### Scheduled Jobs

Nightwatch uses Deno's built-in cron functionality (`Deno.cron`) for regular updates:

- **Content Synchronization**: Runs `/api/periodic-sync` every 6 hours to fetch new tweets and messages.
- **Authentication**: Jobs are protected by a secret token (`CRON_SECRET`) to prevent unauthorized access.

You can customize the cron schedule directly in [`server.production.ts`](./server.production.ts).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/amazing-feature`)
3.  Commit your changes (`git commit -m 'Add some amazing feature'`)
4.  Push to the branch (`git push origin feature/amazing-feature`)
5.  Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE file](./LICENSE) for details.
