import { sql } from "~/lib/db.server.ts";
import { AdvancedSearchResponse, DbAuthor, DbMediaType, DbMentionType, DbUrlType } from "~/lib/types.ts";

export const insertBatchTweetsAndAuthors = async (batch: AdvancedSearchResponse["tweets"]) => {
  // Process this batch of tweets
  // 3. Insert users into the database.
  const authors = batch.reduce(
    (acc, tweet) => {
      acc[tweet.author.id] = {
        id: Number(tweet.author.id),
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
    {} as Record<string, DbAuthor>,
  );

  // --- Format data for Author INSERT using VALUES with ROW/ARRAY literals ---
  const authorSqlFragments: Array<string> = [];
  const authorParams: Array<string | number> = [];
  let authorParamCounter = 1;

  for (const author of Object.values(authors)) {
    // --- Prepare parameters and placeholders for this author ---
    const currentParams: Array<string | number> = [];
    const placeholders: Array<string> = []; // To store $1, $2, etc. for basic fields

    // Basic author fields
    currentParams.push(
      author.id,
      author.username,
      author.display_name,
      author.profile_picture_url,
      author.followers,
      author.following,
    );
    placeholders.push(...currentParams.map(() => `$${authorParamCounter++}`)); // $1 to $6

    // Profile Bio Description
    currentParams.push(author.profile_bio.description);
    const descriptionPlaceholder = `$${authorParamCounter++}`; // $7

    // Mentions Array for profile_bio
    const mentionRowsSql: Array<string> = [];
    for (const mention of author.profile_bio.user_mentions) {
      const mentionPlaceholders = [
        `$${authorParamCounter++}`, // username
        `$${authorParamCounter++}`, // start_index
        `$${authorParamCounter++}`, // end_index
      ];
      mentionRowsSql.push(`ROW(${mentionPlaceholders.join(", ")})`);
      currentParams.push(mention.username, mention.start_index, mention.end_index);
    }
    // Construct the ARRAY literal for mentions, casting the whole array
    const mentionsArraySql =
      mentionRowsSql.length > 0 ? `ARRAY[${mentionRowsSql.join(", ")}]::mention_type[]` : "'{}'::mention_type[]"; // Empty array literal

    // URLs Array for profile_bio
    const urlRowsSql: Array<string> = [];
    for (const url of author.profile_bio.urls) {
      const urlPlaceholders = [
        `$${authorParamCounter++}`, // display_url
        `$${authorParamCounter++}`, // expanded_url
        `$${authorParamCounter++}`, // start_index
        `$${authorParamCounter++}`, // end_index
      ];
      urlRowsSql.push(`ROW(${urlPlaceholders.join(", ")})`);
      currentParams.push(url.display_url, url.expanded_url, url.start_index, url.end_index);
    }
    // Construct the ARRAY literal for URLs, casting the whole array
    const urlsArraySql = urlRowsSql.length > 0 ? `ARRAY[${urlRowsSql.join(", ")}]::url_type[]` : "'{}'::url_type[]"; // Empty array literal

    // Construct the main ROW literal for profile_bio, casting the whole row
    const profileBioRowSql = `ROW(${descriptionPlaceholder}, ${mentionsArraySql}, ${urlsArraySql})::author_bio_type`;

    // Construct the full VALUES fragment for this author: (basic_placeholders..., profile_bio_ROW)
    const fragment = `(${placeholders.join(", ")}, ${profileBioRowSql})`;
    authorSqlFragments.push(fragment);
    authorParams.push(...currentParams); // Add all params for this author to the main list
  }

  // Execute the INSERT query for authors if any authors exist
  if (authorSqlFragments.length > 0) {
    const authorValuesSql = authorSqlFragments.join(",\n  "); // Join fragments for multi-row VALUES
    const authorInsertSql = `
            INSERT INTO authors (id, username, display_name, profile_picture_url, followers, following, profile_bio)
            VALUES
              ${authorValuesSql}
            ON CONFLICT (id) DO UPDATE SET
              username = EXCLUDED.username,
              display_name = EXCLUDED.display_name,
              profile_picture_url = EXCLUDED.profile_picture_url,
              followers = EXCLUDED.followers,
              following = EXCLUDED.following,
              profile_bio = EXCLUDED.profile_bio;
          `;

    await sql.query(authorInsertSql, authorParams); // Pass constructed SQL and flat params list
  }

  // 4. Insert new tweets into the database.
  // --- Format data for Tweet INSERT using VALUES with ROW/ARRAY literals ---
  const tweetSqlFragments: Array<string> = [];
  const tweetParams: Array<string | number | null> = [];
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
    const currentParams: Array<string | number | null> = [];
    const placeholders: Array<string> = []; // To store $1, $2, etc. for basic fields

    // Basic tweet fields
    currentParams.push(
      Number(tweet.id),
      tweet.url,
      tweet.text,
      Number(tweet.author.id),
      tweet.conversationId ? Number(tweet.conversationId) : null,
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
            INSERT INTO tweets (id, url, text, author_id, conversation_id, created_at, user_mentions, urls, medias)
            VALUES
              ${tweetValuesSql}
            ON CONFLICT (id) DO NOTHING;
          `;
    await sql.query(tweetInsertSql, tweetParams); // Pass constructed SQL and flat params list
  }

  return batch.length;
};
