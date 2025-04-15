# Nightwatch

**A public archive of investigations into crypto scams and bad actors.**

Nightwatch collects and preserves tweets from trusted blockchain sleuths, turning volatile threads into a convenient searchable record.

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
  - [Twitter API Integration](#twitter-api-integration)
  - [Caching Strategy](#caching-strategy)
  - [Scheduled Jobs](#scheduled-jobs)
- [Contributing](#contributing)
- [License](#license)

## Introduction

### Overview

Nightwatch serves as a permanent archive for investigations conducted by trusted blockchain investigators like @zachxbt.

The application indexes tweets from selected accounts, along with media attachments, and metadata. This creates a reliable reference point to research potential scams and bad actors, with an easily searchable interface with reliable results curated by essence.

### Key Features

- **Permanent Archive**: Tweets are stored in a database, ensuring they remain accessible even if deleted from Twitter
- **Full-Text Search**: Search through the entire archive using keywords
- **Conversation Context**: View entire threads and replies from relevant accounts
- **Media Preservation**: Images and other media attached to tweets are preserved and viewable
- **Regular Updates**: Automatic synchronization with Twitter to capture new content

## Getting Started

### Prerequisites

- [Deno](https://deno.com/) (v1.37 or higher)
- [Node.js](https://nodejs.org/) (v20 or higher)
- [pnpm](https://pnpm.io/) (v8 or higher)
- A [Neon](https://neon.tech/) PostgreSQL database
- A [TwitterAPI.io](https://twitterapi.io/) API key

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
   ```

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

1. **Data Collection**: Tweets from specified accounts are fetched from [TwitterAPI.io](https://twitterapi.io/)
2. **Data Processing**: Tweets are parsed and normalized, extracting mentions, URLs, and media
3. **Data Storage**: Processed tweets are stored in a [Neon](https://neon.tech/) database
4. **Data Retrieval**: Users query the database through the search interface
5. **Data Presentation**: Results are displayed with highlighting and context

### API Endpoints

- **`/api/search`**: Search for tweets matching a query
- **`/api/sync`**: Trigger a synchronization with Twitter (protected by auth)
- **`/api/initial-sync`**: Perform initial backfill for a specific user (protected by auth)
- **`/api/health`**: Check the health of the application and its dependencies

### Database Schema

The database uses two main tables:

1. **`authors`**: Stores information about tweet authors

   - `id`: Unique identifier (Twitter user ID)
   - `username`: Twitter handle
   - `display_name`: Display name
   - `profile_picture_url`: URL to profile picture
   - `followers`: Follower count
   - `following`: Following count
   - `profile_bio`: JSON object containing bio information

2. **`tweets`**: Stores the tweets themselves
   - `id`: Unique identifier (Twitter tweet ID)
   - `url`: URL to the original tweet
   - `text`: Tweet content
   - `author_id`: Foreign key to authors table
   - `conversation_id`: ID of the conversation thread
   - `created_at`: Timestamp of tweet creation
   - `user_mentions`: Array of mentioned users
   - `urls`: Array of URLs in the tweet
   - `medias`: Array of media attachments

You can directly use [the reference SQL schema](./resources/init.sql) to create the database.

## Technical Details

### Twitter API Integration

Nightwatch uses [TwitterAPI.io](https://twitterapi.io/) to fetch tweets through their advanced search endpoint. The application implements:

- **Batch Processing**: Tweets are fetched and processed in batches
- **Cursor-based Pagination**: For handling large result sets
- **Differential Updates**: Only fetching tweets newer than the most recent one in the database

You can manually trigger a sync with the `/api/sync` endpoint.

```bash
curl -X POST "http://localhost:5173/api/sync" -H "Content-Type: application/json" -H "Authorization: Bearer $CRON_SECRET" # this uses localhost but it could be the deployed endpoint
```

Or run a full sync for a new user:

```bash
curl -X POST "http://localhost:5173/api/initial-sync?username=zachxbt" -H "Content-Type: application/json" -H "Authorization: Bearer $CRON_SECRET"
```

You can customize the relevant users in [constants.server.ts](./app/lib/constants.server.ts) at `RELEVANT_USERS`. Same for the `BATCH_SIZE`.

### Caching Strategy

The application implements a caching strategy to improve performance and reduce API calls:

- **Search Results Caching**: Search results are cached for 1 hour

You can customize the cache TTL in [constants.server.ts](./app/lib/constants.server.ts) at `CACHE_TTL`.

### Scheduled Jobs

Nightwatch uses Deno's built-in cron functionality to schedule regular updates:

- **Tweet Synchronization**: Runs every 6 hours to fetch new tweets
- **Authentication**: Jobs are protected by a secret token to prevent unauthorized access

You can customize the cron schedule in [constants.server.ts](./app/lib/constants.server.ts) at `CRON_SCHEDULE`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
