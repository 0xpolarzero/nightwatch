"use client";

import { createContext, ReactNode, useContext, useState } from "react";

import { ApiSearchResponse, Tweet } from "@/lib/types";

// Define the shape of our search results
export interface SearchResult {
  tweets: Array<Tweet>;
}

// Define the shape of our search context
interface SearchContextType {
  query: string;
  setQuery: (query: string) => void;
  result: SearchResult | undefined;
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
  const [result, setResult] = useState<SearchResult | undefined>(undefined);
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
      setResult({
        tweets: data.tweets.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      });
      console.log(data);
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
