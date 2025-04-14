Nightwatch is a public archive of investigations into crypto scams and bad actors.

It collects and preserves tweets from trusted blockchain sleuths, turning volatile threads into a convenient searchable record.

A ledger of exposure. A watchful memory. A stain that won't fade.

# Welcome to Remix!

- 📖 [Remix docs](https://remix.run/docs)

## Development

Run the dev server:

- **Frontend**: Next.js with App Router
- **API**: Next.js Route Handlers as serverless functions
- **Database**: Neon PostgreSQL serverless database

### Key Features

- Next.js frontend for searching tweets
- Serverless API routes that protect sensitive environment variables
- Scheduled cron job to update tweets database (every 6 hours)
- Local development environment that mirrors production

## Local Development

### Prerequisites

- Node.js 18+ and pnpm
- A Neon PostgreSQL database
- Twitter API credentials

### Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env.local` file in the root directory with your environment variables:

   ```
   NEON_DATABASE_URL=your_neon_database_url
   TWITTERAPI_API_KEY=your_twitter_api_key
   ```

4. Set up your database schema:

   ```sql
   CREATE TABLE author (
     id TEXT PRIMARY KEY,
     username TEXT NOT NULL,
     name TEXT NOT NULL,
     profile_picture_url TEXT
   );

   CREATE TABLE tweet (
     id TEXT PRIMARY KEY,
     text TEXT NOT NULL,
     author_id TEXT NOT NULL REFERENCES author(id),
     created_at TIMESTAMP WITH TIME ZONE NOT NULL,
     is_reply_to_id TEXT,
     url TEXT NOT NULL,
     FOREIGN KEY (is_reply_to_id) REFERENCES tweet(id)
   );

   CREATE INDEX tweet_author_id_idx ON tweet(author_id);
   CREATE INDEX tweet_created_at_idx ON tweet(created_at);
   CREATE INDEX tweet_text_idx ON tweet USING gin (to_tsvector('english', text));
   ```

5. Start the development server:
   ```bash
   pnpm dev
   ```

This will run the Next.js development server which includes:

- The Next.js frontend application
- The API routes in the `/app/api` directory
- Environment variables from `.env.local`

### Testing Locally

- Frontend is available at: http://localhost:3000
- API endpoints:
  - http://localhost:3000/api/health - Check API and database status
  - http://localhost:3000/api/search-tweets?query=yourquery - Search for tweets
  - http://localhost:3000/api/update-tweets - Manually update tweets database

## API Endpoints

### GET /api/health

Check the health of the API and its connections.

**Response:**

```json
{
  "status": "ok",
  "message": "API is healthy",
  "timestamp": "2023-04-13T12:34:56.789Z",
  "environment": "development",
  "checks": {
    "databaseConfigured": true,
    "databaseConnected": true,
    "twitterApiConfigured": true
  }
}
```

### GET /api/search-tweets?query={searchTerm}

Search for tweets containing the specified query text.

**Parameters:**

- `query` (required): Text to search for in tweets

**Response:**

```json
{
  "tweets": [
    {
      "id": "1234567890",
      "text": "This is a tweet containing your search term",
      "created_at": "2023-04-13T12:34:56.789Z",
      "author_id": "user123",
      "reply_to_id": null,
      "username": "twitteruser",
      "name": "Twitter User"
    }
  ]
}
```

### GET or POST /api/update-tweets

Update the tweets database with the latest tweets from the configured account.

**Response:**

```json
{
  "message": "Tweets updated successfully",
  "inserted": 10
}
```

## Deployment

First, build your app for production:

```sh
npm run build
```

2. Create a new project on Vercel

   - Connect your Git repository
   - Vercel will automatically detect the Next.js configuration

3. Configure environment variables in the Vercel dashboard:

   - Add `NEON_DATABASE_URL`
   - Add `TWITTERAPI_API_KEY`

4. Deploy the application

   - Vercel will build and deploy the Next.js application

### DIY

If you're familiar with deploying Node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `npm run build`

1. **Frontend**:

   - Static assets are served from Vercel's global CDN
   - Server components are rendered at the edge or on Vercel's serverless functions

2. **API**:

   - API routes are deployed as serverless functions
   - Each route can scale independently
   - Environment variables are securely stored on Vercel

3. **Cron Jobs**:
   - The `update-tweets` endpoint is automatically called on the schedule defined in `vercel.json`
   - This keeps your database updated with the latest tweets

## Best Practices Followed

- **Security**:

  - API keys and database credentials are never exposed to the client
  - Environment variables are properly secured
  - Parameterized SQL queries to prevent SQL injection

- **Architecture**:

  - Next.js App Router for modern React features
  - Server Components for improved performance
  - Serverless approach for easy scaling and maintenance
  - Database connections are handled efficiently with Neon's serverless approach

- **Development Workflow**:
  - Local development that mirrors production environment
  - TypeScript for type safety throughout the application
  - Shared database connection handling

## Debugging

- For local API issues, check the console output from `pnpm dev`
- For database issues, check your Neon console
- For deployment issues, check the Vercel deployment logs
- Use the `/api/health` endpoint to verify connections

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Route Handlers Documentation](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) - learn about Next.js API routes.
