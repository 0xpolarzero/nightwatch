import { NeonQueryInTransaction } from "@neondatabase/serverless";

import { sql } from "~/lib/db.server.ts";
import {
  AdvancedSearchResponse,
  DbMediaType,
  DbMentionType,
  DbTelegramChannel,
  DbTelegramMessage,
  DbTwitterUser,
  DbUrlType,
} from "~/lib/types.ts";

export const insertBatchTweetsAndUsers = async (batch: AdvancedSearchResponse["tweets"]) => {
  // Process this batch of tweets
  // 3. Insert users into the database.
  const users = batch.reduce(
    (acc, tweet) => {
      acc[tweet.author.id] = {
        id: BigInt(tweet.author.id),
        username: tweet.author.userName,
        display_name: tweet.author.name,
        profile_picture_url: tweet.author.profilePicture,
        followers: tweet.author.followers,
        following: tweet.author.following,
        profile_bio: {
          description: tweet.author.profile_bio.description,
          user_mentions: tweet.author.profile_bio.entities.description.user_mentions.map((user_mention) => ({
            username: user_mention.screen_name,
            start_index: user_mention.indices[0],
            end_index: user_mention.indices[1],
          })),
          urls: tweet.author.profile_bio.entities.url.urls.map((url) => ({
            display_url: url.display_url,
            expanded_url: url.expanded_url,
            start_index: url.indices[0],
            end_index: url.indices[1],
          })),
        },
      };
      return acc;
    },
    {} as Record<string, DbTwitterUser>,
  );

  // --- Format data for user INSERT using VALUES with ROW/ARRAY literals ---
  const userSqlFragments: Array<string> = [];
  const userParams: Array<string | bigint | number> = [];
  let userParamCounter = 1;

  for (const user of Object.values(users)) {
    // --- Prepare parameters and placeholders for this user ---
    const currentParams: Array<string | bigint | number> = [];
    const placeholders: Array<string> = []; // To store $1, $2, etc. for basic fields

    // Basic user fields
    currentParams.push(
      user.id,
      user.username,
      user.display_name,
      user.profile_picture_url,
      user.followers,
      user.following,
    );
    placeholders.push(...currentParams.map(() => `$${userParamCounter++}`)); // $1 to $6

    // Profile Bio Description
    currentParams.push(user.profile_bio.description);
    const descriptionPlaceholder = `$${userParamCounter++}`; // $7

    // Mentions Array for profile_bio
    const mentionRowsSql: Array<string> = [];
    for (const mention of user.profile_bio.user_mentions) {
      const mentionPlaceholders = [
        `$${userParamCounter++}`, // username
        `$${userParamCounter++}`, // start_index
        `$${userParamCounter++}`, // end_index
      ];
      mentionRowsSql.push(`ROW(${mentionPlaceholders.join(", ")})`);
      currentParams.push(mention.username, mention.start_index, mention.end_index);
    }
    // Construct the ARRAY literal for mentions, casting the whole array
    const mentionsArraySql =
      mentionRowsSql.length > 0 ? `ARRAY[${mentionRowsSql.join(", ")}]::mention_type[]` : "'{}'::mention_type[]"; // Empty array literal

    // URLs Array for profile_bio
    const urlRowsSql: Array<string> = [];
    for (const url of user.profile_bio.urls) {
      const urlPlaceholders = [
        `$${userParamCounter++}`, // display_url
        `$${userParamCounter++}`, // expanded_url
        `$${userParamCounter++}`, // start_index
        `$${userParamCounter++}`, // end_index
      ];
      urlRowsSql.push(`ROW(${urlPlaceholders.join(", ")})`);
      currentParams.push(url.display_url, url.expanded_url, url.start_index, url.end_index);
    }
    // Construct the ARRAY literal for URLs, casting the whole array
    const urlsArraySql = urlRowsSql.length > 0 ? `ARRAY[${urlRowsSql.join(", ")}]::url_type[]` : "'{}'::url_type[]"; // Empty array literal

    // Construct the main ROW literal for profile_bio, casting the whole row
    const profileBioRowSql = `ROW(${descriptionPlaceholder}, ${mentionsArraySql}, ${urlsArraySql})::user_bio_type`;

    // Construct the full VALUES fragment for this user: (basic_placeholders..., profile_bio_ROW)
    const fragment = `(${placeholders.join(", ")}, ${profileBioRowSql})`;
    userSqlFragments.push(fragment);
    userParams.push(...currentParams); // Add all params for this user to the main list
  }

  // Execute the INSERT query for users if any users exist
  if (userSqlFragments.length > 0) {
    const userValuesSql = userSqlFragments.join(",\n  "); // Join fragments for multi-row VALUES
    const userInsertSql = `
            INSERT INTO tw_users (id, username, display_name, profile_picture_url, followers, following, profile_bio)
            VALUES
              ${userValuesSql}
            ON CONFLICT (id) DO UPDATE SET
              username = EXCLUDED.username,
              display_name = EXCLUDED.display_name,
              profile_picture_url = EXCLUDED.profile_picture_url,
              followers = EXCLUDED.followers,
              following = EXCLUDED.following,
              profile_bio = EXCLUDED.profile_bio;
          `;

    await sql.query(userInsertSql, userParams); // Pass constructed SQL and flat params list
  }

  // 4. Insert new tweets into the database.
  // --- Format data for Tweet INSERT using VALUES with ROW/ARRAY literals ---
  const tweetSqlFragments: Array<string> = [];
  const tweetParams: Array<string | number | bigint | null> = [];
  let tweetParamCounter = 1;

  for (const tweet of batch) {
    // Prepare tweet mentions, urls, medias (as objects)
    const tweetMentions: DbMentionType[] =
      tweet.entities?.user_mentions?.map((mention) => ({
        username: mention.screen_name,
        start_index: mention.indices[0],
        end_index: mention.indices[1],
      })) ?? [];
    const tweetUrls: DbUrlType[] =
      tweet.entities?.urls?.map((url) => ({
        display_url: url.display_url,
        expanded_url: url.expanded_url,
        start_index: url.indices[0],
        end_index: url.indices[1],
      })) ?? [];
    const tweetMedias: DbMediaType[] =
      tweet.extendedEntities?.media?.map((media) => ({
        url: media.media_url_https,
        type: media.type,
        width: media.sizes?.large?.w ?? null,
        height: media.sizes?.large?.h ?? null,
        start_index: media.indices[0],
        end_index: media.indices[1],
      })) ?? [];

    // --- Prepare parameters and placeholders for this tweet ---
    const currentParams: Array<string | number | bigint | null> = [];
    const placeholders: Array<string> = []; // To store $1, $2, etc. for basic fields

    // Basic tweet fields
    currentParams.push(
      BigInt(tweet.id),
      tweet.url,
      tweet.text,
      BigInt(tweet.author.id),
      tweet.conversationId ? BigInt(tweet.conversationId) : null,
      tweet.createdAt,
    );
    placeholders.push(...currentParams.map(() => `$${tweetParamCounter++}`)); // $1 to $6

    // Mentions Array
    const mentionRowsSql: Array<string> = [];
    for (const mention of tweetMentions) {
      const mentionPlaceholders = [
        `$${tweetParamCounter++}`, // username
        `$${tweetParamCounter++}`, // start_index
        `$${tweetParamCounter++}`, // end_index
      ];
      mentionRowsSql.push(`ROW(${mentionPlaceholders.join(", ")})`);
      currentParams.push(mention.username, mention.start_index, mention.end_index);
    }
    const mentionsArraySql =
      mentionRowsSql.length > 0 ? `ARRAY[${mentionRowsSql.join(", ")}]::mention_type[]` : "'{}'::mention_type[]";

    // URLs Array
    const urlRowsSql: Array<string> = [];
    for (const url of tweetUrls) {
      const urlPlaceholders = [
        `$${tweetParamCounter++}`, // display_url
        `$${tweetParamCounter++}`, // expanded_url
        `$${tweetParamCounter++}`, // start_index
        `$${tweetParamCounter++}`, // end_index
      ];
      urlRowsSql.push(`ROW(${urlPlaceholders.join(", ")})`);
      currentParams.push(url.display_url, url.expanded_url, url.start_index, url.end_index);
    }
    const urlsArraySql = urlRowsSql.length > 0 ? `ARRAY[${urlRowsSql.join(", ")}]::url_type[]` : "'{}'::url_type[]";

    // Media Array
    const mediaRowsSql: Array<string> = [];
    for (const media of tweetMedias) {
      const mediaPlaceholders = [
        `$${tweetParamCounter++}`, // url
        `$${tweetParamCounter++}`, // type
        `$${tweetParamCounter++}`, // width (can be null)
        `$${tweetParamCounter++}`, // height (can be null)
        `$${tweetParamCounter++}`, // start_index
        `$${tweetParamCounter++}`, // end_index
      ];
      mediaRowsSql.push(`ROW(${mediaPlaceholders.join(", ")})`);
      currentParams.push(media.url, media.type, media.width, media.height, media.start_index, media.end_index);
    }
    const mediasArraySql =
      mediaRowsSql.length > 0 ? `ARRAY[${mediaRowsSql.join(", ")}]::media_type[]` : "'{}'::media_type[]";

    // Construct the full VALUES fragment for this tweet: (basic_placeholders..., mentions_ARRAY, urls_ARRAY, medias_ARRAY)
    const fragment = `(${placeholders.join(", ")}, ${mentionsArraySql}, ${urlsArraySql}, ${mediasArraySql})`;
    tweetSqlFragments.push(fragment);
    tweetParams.push(...currentParams); // Add all params for this tweet
  }

  // Execute the INSERT query for tweets if any tweets exist
  if (tweetSqlFragments.length > 0) {
    const tweetValuesSql = tweetSqlFragments.join(",\n  "); // Join fragments
    const tweetInsertSql = `
            INSERT INTO tw_posts (id, url, text, user_id, conversation_id, created_at, user_mentions, urls, medias)
            VALUES
              ${tweetValuesSql}
            ON CONFLICT (id) DO NOTHING;
          `;
    await sql.query(tweetInsertSql, tweetParams); // Pass constructed SQL and flat params list
  }

  return batch.length;
};

export const insertBatchTelegramMessagesAndChannel = async (
  messages: Array<Omit<DbTelegramMessage, "channel" | "thread_id">>,
  channelInfo: DbTelegramChannel,
) => {
  // 1. Insert or update the channel information
  const channelParams = [
    channelInfo.id,
    channelInfo.title,
    channelInfo.about,
    channelInfo.channel_username,
    channelInfo.admin_usernames,
  ];

  const channelInsertSql = `
    INSERT INTO tg_channels (id, title, about, channel_username, admin_usernames)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      about = EXCLUDED.about,
      channel_username = EXCLUDED.channel_username,
      admin_usernames = EXCLUDED.admin_usernames;
  `;

  await sql.query(channelInsertSql, channelParams);

  // 2. Insert messages using temp table and pre-calculating thread_id
  if (messages.length === 0) return 0;

  // Use a transaction to ensure temp table exists only for this operation
  await sql.transaction((tx) => {
    const queries: Array<NeonQueryInTransaction> = [];

    // --- Step 2a: Create Temp Table (without thread_id initially) ---
    queries.push(
      tx.query(`
        CREATE TEMP TABLE _incoming_tg_messages (
          id TEXT PRIMARY KEY,
          message_id BIGINT NOT NULL,
          message TEXT NOT NULL,
          url TEXT NOT NULL,
          channel_id BIGINT NOT NULL,
          reply_to_message_id BIGINT,
          created_at TIMESTAMPTZ NOT NULL,
          has_media BOOLEAN NOT NULL,
          urls url_type[]
          -- No thread_id column initially
        ) ON COMMIT DROP;
      `),
    );

    // --- Step 2b: Prepare and Insert into Temp Table ---
    const messageSqlFragments: Array<string> = [];
    const messageParams: Array<string | number | bigint | boolean | null> = [];
    let messageParamCounter = 1;

    for (const message of messages) {
      const currentParams: Array<string | number | bigint | boolean | null> = [];
      const placeholders: Array<string> = [];

      // Basic fields (no thread_id)
      currentParams.push(
        message.id,
        message.message_id,
        message.message,
        message.url,
        message.channel_id,
        message.reply_to_message_id,
        message.created_at,
        message.has_media,
      );
      placeholders.push(...currentParams.map(() => `$${messageParamCounter++}`)); // $1 to $8

      // URLs Array - Build ROW expressions and collect individual parameters
      const urlRowsSql: Array<string> = [];
      if (message.urls && message.urls.length > 0) {
        for (const url of message.urls) {
          const urlPlaceholders = [
            `$${messageParamCounter++}`, // display_url
            `$${messageParamCounter++}`, // expanded_url
            `$${messageParamCounter++}`, // start_index
            `$${messageParamCounter++}`, // end_index
          ];
          urlRowsSql.push(`ROW(${urlPlaceholders.join(", ")})`);
          currentParams.push(url.display_url, url.expanded_url, url.start_index, url.end_index);
        }
      }
      // Construct the ARRAY literal SQL fragment, casting the whole array.
      const urlsArraySql = urlRowsSql.length > 0 ? `ARRAY[${urlRowsSql.join(", ")}]::url_type[]` : "NULL"; // Use SQL NULL for empty arrays

      // Construct the full VALUES fragment for this message for the temp table:
      // (basic_placeholders..., urls_ARRAY_SQL_Fragment)
      // Note: urlsArraySql is part of the SQL string, not a placeholder itself.
      const fragment = `(${placeholders.join(", ")}, ${urlsArraySql})`;
      messageSqlFragments.push(fragment);
      // Add all parameters collected for this message (basic fields + URL components)
      messageParams.push(...currentParams);
    }

    // Execute insert into temp table if needed
    if (messageSqlFragments.length > 0) {
      const messageValuesSql = messageSqlFragments.join(",\n  ");
      const tempInsertSql = `
        INSERT INTO _incoming_tg_messages (
          id, message_id, message, url, channel_id, reply_to_message_id,
          created_at, has_media, urls
        )
        VALUES
          ${messageValuesSql};
      `;
      // Pass the flat list of all collected parameters
      queries.push(tx.query(tempInsertSql, messageParams));
    }

    // --- Step 2c: Add thread_id column to temp table ---
    queries.push(tx.query(`ALTER TABLE _incoming_tg_messages ADD COLUMN thread_id TEXT;`));

    // --- Step 2d: Calculate thread_id using Recursive CTE and Update Temp Table ---
    // Only run if there were messages inserted into the temp table
    if (messageSqlFragments.length > 0) {
      queries.push(
        tx.query(`
          WITH RECURSIVE thread_roots AS (
              -- Anchor: Messages that are roots OR reply to something already in the final table
              SELECT
                  tmp.id AS message_id,
                  -- Use final parent's thread_id, or final parent's id, or tmp's id as the root
                  COALESCE(final_parent.thread_id, final_parent.id, tmp.id) AS root_id,
                  0 as depth -- For cycle detection/prevention
              FROM _incoming_tg_messages tmp
              LEFT JOIN tg_messages final_parent -- Check final table for parent
                  ON tmp.channel_id = final_parent.channel_id
                  AND tmp.reply_to_message_id = final_parent.message_id
              -- Anchor condition: message is a root OR its parent is outside the batch (in final table)
              WHERE tmp.reply_to_message_id IS NULL OR final_parent.id IS NOT NULL

              UNION ALL

              -- Recursive step: Find children (within the batch) of messages already processed
              SELECT
                  child.id AS message_id,
                  tr.root_id, -- Propagate the root_id from the parent
                  tr.depth + 1
              FROM _incoming_tg_messages child
              -- Find the parent *within the temp table*
              JOIN _incoming_tg_messages parent_in_batch
                  ON child.reply_to_message_id = parent_in_batch.message_id
                  AND child.channel_id = parent_in_batch.channel_id
              -- Join parent_in_batch to the recursive set (thread_roots) to link to the root
              JOIN thread_roots tr ON parent_in_batch.id = tr.message_id
              WHERE tr.depth < 50 -- Safety break for deep threads or potential cycles
          )
          -- Update the temp table with the calculated root_id for each message
          UPDATE _incoming_tg_messages tmp
          SET thread_id = tr.root_id
          FROM thread_roots tr
          WHERE tmp.id = tr.message_id;
        `),
      );
    }

    // --- Step 2e: Insert from Temp Table (with calculated thread_id) into Final Table ---
    if (messageSqlFragments.length > 0) {
      const finalInsertSql = `
        INSERT INTO tg_messages (
          id, message_id, message, url, channel_id, reply_to_message_id,
          created_at, has_media, urls,
          thread_id -- Select the pre-calculated thread_id
        )
        SELECT
          tmp.id,
          tmp.message_id,
          tmp.message,
          tmp.url,
          tmp.channel_id,
          tmp.reply_to_message_id,
          tmp.created_at,
          tmp.has_media,
          tmp.urls,
          tmp.thread_id -- Select the calculated thread_id from the temp table
        FROM
          _incoming_tg_messages tmp
        ON CONFLICT (id) DO NOTHING; -- No complex COALESCE needed here anymore
      `;
      queries.push(tx.query(finalInsertSql));
    }

    return queries;
  });

  return messages.length;
};
