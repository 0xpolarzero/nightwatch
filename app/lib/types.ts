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
            user_mentions: Array<{
              screen_name: string;
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

export interface DbAuthorBioType {
  description: string;
  user_mentions: DbMentionType[];
  urls: DbUrlType[];
}

export interface DbAuthor {
  id: number;
  username: string;
  display_name: string;
  profile_picture_url: string;
  followers: number;
  following: number;
  profile_bio: DbAuthorBioType;
}

export interface DbTweet {
  id: number;
  url: string;
  text: string;
  author_id: number;
  conversation_id: number | null;
  created_at: string;
  author: DbAuthor;
  user_mentions: Array<DbMentionType> | null;
  urls: Array<DbUrlType> | null;
  medias: Array<DbMediaType> | null;
}

// API response types
export interface ApiSearchResponse {
  tweets: Array<DbTweet>;
  error?: string;
}

export interface ApiSyncResponse {
  message: string;
  inserted: number;
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

// Error response
export interface ErrorResponse {
  error: string;
}
