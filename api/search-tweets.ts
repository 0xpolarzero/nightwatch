import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from 'pg';

const ALLOWED_ORIGIN = process.env.FRONTEND_URL; // e.g. "https://your-domain.com"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optionally restrict the endpoint to calls from your frontend
  const origin = req.headers.origin || req.headers.referer;
  if (
    ALLOWED_ORIGIN &&
    (!origin || !origin.toString().startsWith(ALLOWED_ORIGIN))
  ) {
    return res.status(401).json({ error: 'Unauthorized domain' });
  }

  const { query } = req.query;

  const client = new Client({ connectionString: process.env.NEON_DB_URL });
  await client.connect();

  try {
    const result = await client.query(
      `SELECT id, text, created_at 
       FROM tweets 
       WHERE text ILIKE $1 
       ORDER BY created_at DESC`,
      [`%${query || ''}%`],
    );
    res.status(200).json({ tweets: result.rows });
  } catch (error) {
    console.error('Error searching tweets:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await client.end();
  }
}
