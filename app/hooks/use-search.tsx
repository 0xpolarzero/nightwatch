import { createContext, ReactNode, useContext, useState } from "react";

import type { ApiSearchResponse, DbTweet } from "~/lib/types";

// Define the shape of our search context
interface SearchContextType {
  query: string;
  setQuery: (query: string) => void;
  result: Array<DbTweet> | undefined;
  isLoading: boolean;
  error: string | null;
  search: () => Promise<void>;
  clearResults: () => void;
}

// Create the context with a default value
const SearchContext = createContext<SearchContextType | undefined>(undefined);

// Provider props
interface SearchProviderProps {
  children: ReactNode;
}

export const SearchProvider = ({ children }: SearchProviderProps) => {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Array<DbTweet> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) {
      setResult(undefined);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      const data = (await response.json()) as ApiSearchResponse;
      if (data.error) {
        setError(data.error);
        return;
      }

      setResult(data.tweets.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } catch (err) {
      setError("Failed to perform search. Please try again.");
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResult(undefined);
    setQuery("");
  };

  return (
    <SearchContext.Provider
      value={{
        query,
        setQuery,
        result,
        isLoading,
        error,
        search,
        clearResults,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

// Custom hook to use the search context
export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
};
