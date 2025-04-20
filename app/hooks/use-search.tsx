import { createContext, ReactNode, useContext, useState } from "react";

import type { ApiSearchResponse } from "~/lib/types.ts";

// Define the shape of our search context
interface SearchContextType {
  query: string;
  setQuery: (query: string) => void;
  result: ApiSearchResponse | undefined;
  isLoading: boolean;
  error: string | null;
  search: () => Promise<void>;
  init: () => Promise<void>;
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
  const [result, setResult] = useState<ApiSearchResponse | undefined>(undefined);
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

      setResult(data);
    } catch (err) {
      setError("Failed to perform search. Please try again.");
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const init = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/home`);
      const data = (await response.json()) as ApiSearchResponse;
      if (data.error) {
        setError(data.error);
        return;
      }

      setResult(data);
    } catch (err) {
      setError("Failed to init. Please try again.");
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
        init,
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
