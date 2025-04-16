// Define types for Twitter API responses
export interface AdvancedSearchResponse {
  tweets: Array<{
    id: string;
    url: string;
    text: string;
    createdAt: string;
    conversationId: string | null;
    author: {
      id: string;
      userName: string;
      name: string;
      profilePicture: string;
      followers: number;
      following: number;
      profile_bio: {
        description: string;
        entities: {
          description: {
            user_mentions?: Array<{
              screen_name: string;
              indices: [number, number];
            }>;
            urls?: Array<{
              display_url: string;
              expanded_url: string;
              indices: [number, number];
            }>;
          };
          url: {
            urls: Array<{
              display_url: string;
              expanded_url: string;
              indices: [number, number];
            }>;
          };
        };
      };
    };
    entities: {
      user_mentions: Array<{
        screen_name: string;
        indices: [number, number];
      }>;
      urls: Array<{
        display_url: string;
        expanded_url: string;
        indices: [number, number];
      }>;
    };
    extendedEntities: {
      media: Array<{
        media_url_https: string;
        sizes: {
          large: {
            h: number;
            w: number;
          };
        };
        type: "photo" | "video" | "animated_gif"; // TODO: not sure
        indices: [number, number];
      }>;
    };
  }>;
  has_next_page: boolean;
  next_cursor: string | undefined;
}

// Define types for our database models
export interface DbUrlType {
  display_url: string;
  expanded_url: string;
  start_index: number;
  end_index: number;
}

export interface DbMentionType {
  username: string;
  start_index: number;
  end_index: number;
}

export interface DbMediaType {
  url: string;
  type: string;
  width: number;
  height: number;
  start_index: number;
  end_index: number;
}

export interface DbUserBioType {
  description: string;
  user_mentions: DbMentionType[];
  url_mentions: DbUrlType[];
  urls: DbUrlType[];
}

export interface DbTwitterUser {
  id: bigint;
  username: string;
  display_name: string;
  profile_picture_url: string;
  followers: number;
  following: number;
  profile_bio: DbUserBioType;
}

export interface DbTweet {
  id: bigint;
  url: string;
  text: string;
  user_id: bigint;
  conversation_id: bigint | null;
  created_at: string;
  user: DbTwitterUser;
  user_mentions: Array<DbMentionType> | null;
  urls: Array<DbUrlType> | null;
  medias: Array<DbMediaType> | null;
}

// Define types for Telegram database models
export interface DbTelegramChannel {
  id: bigint;
  title: string;
  about: string;
  channel_username: string;
  admin_usernames: string[];
}

export interface DbTelegramMessage {
  id: `${string}-${string}`;
  message_id: bigint;
  message: string;
  url: string;
  channel_id: bigint;
  reply_to_message_id: bigint | null;
  created_at: string;
  urls: Array<DbUrlType> | null;
  has_media: boolean;
  thread_id: string;
  channel: DbTelegramChannel;
  reply_to?: DbTelegramMessage;
}

// API response types
export interface ApiSearchResponse {
  tweets: Array<DbTweet>;
  tgMessages: Array<DbTelegramMessage>;
  error?: string;
}

export interface ApiSyncResponse {
  message: string;
  inserted: Record<string, number>;
  error?: string;
}

// Health check response
export interface HealthResponse {
  status: "ok" | "error";
  message: string;
  timestamp: string;
  environment: string;
  checks: {
    databaseConfigured: boolean;
    databaseConnected: boolean;
    twitterApiConfigured: boolean;
  };
}

// Sync source types
export type SyncSource = { platform: "twitter"; username: string } | { platform: "telegram"; channel: string };
