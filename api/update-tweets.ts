import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check if the call includes the correct secret header.
  const providedSecret = req.headers['x-cron-secret'];
  if (providedSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Proceed with processing (fetch tweets, update DB, etc.)
  const client = new Client({ connectionString: process.env.NEON_DB_URL });
  await client.connect();

  try {
    // Build Twitter API URL (example uses Twitter API v2)
    const twitterApiUrl = `https://api.twitter.com/2/users/${process.env.TWITTER_USER_ID}/tweets?max_results=5`;

    // Call Twitter API
    const apiResponse = await fetch(twitterApiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`Twitter API error: ${apiResponse.statusText}`);
    }

    const tweetsData = await apiResponse.json();

    if (!tweetsData.data) {
      throw new Error('No tweet data returned');
    }

    // Insert tweets into the database (using upsert to avoid duplicates)
    for (const tweet of tweetsData.data) {
      await client.query(
        'INSERT INTO tweets (id, text, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING',
        [tweet.id, tweet.text],
      );
    }

    res.status(200).json({ message: 'Tweets updated successfully.' });
  } catch (error) {
    console.error('Error fetching tweets:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
}
