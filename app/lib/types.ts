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
    };
  }>;
  has_next_page: boolean;
  next_cursor: string | undefined;
}

// Define types for our database models
export interface Author {
  id: number;
  username: string;
  name: string;
  profile_picture_url: string;
}

export interface Tweet {
  id: number;
  text: string;
  author_id: number;
  created_at: string;
  conversation_id: number | null;
  url: string;
  author: Author;
}

// API response types
export interface ApiSearchResponse {
  tweets: Tweet[];
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
