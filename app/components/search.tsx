import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button.tsx";
import { Input } from "~/components/ui/input.tsx";
import { useSearch } from "~/hooks/use-search.tsx";

export const Search = () => {
  const { query, setQuery, search, isLoading } = useSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search();
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-4">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Input anything you want to look up..."
        className="sm:min-w-[300px] text-sm sm:text-base"
      />
      <Button type="submit" variant="outline" className="cursor-pointer" onClick={search} disabled={isLoading}>
        {!!isLoading && (
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" />
            Searching...
          </div>
        )}
        {!isLoading && "Search"}
      </Button>
    </form>
  );
};
