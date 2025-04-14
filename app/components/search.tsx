import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button.tsx";
import { Input } from "~/components/ui/input.tsx";
import { useSearch } from "~/hooks/use-search.tsx";

export const Search = () => {
  const { query, setQuery, search, isLoading } = useSearch();

  return (
    <div className="flex gap-4">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Input anything you want to look up..."
        className="min-w-[300px]"
      />
      <Button variant="outline" className="cursor-pointer" onClick={search} disabled={isLoading}>
        {!!isLoading && (
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" />
            Searching...
          </div>
        )}
        {!isLoading && "Search"}
      </Button>
    </div>
  );
};
