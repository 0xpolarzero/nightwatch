import { useSearch } from "~/hooks/use-search.tsx";

export const Home = () => {
  const { result, isLoading } = useSearch();

  if (result || isLoading) return null;
  return (
    <div className="flex items-center flex-1">
      <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-4 items-center justify-center w-[90vw] max-w-[700px] mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-foreground">Welcome to nightwatch</h1>
          <p className="text-lg text-muted-foreground">
            A public archive of investigations into crypto scams and bad actors.
          </p>
        </div>
        <img src="/logo-white.png" alt="Nightwatch Logo" className="size-24 hidden sm:block" />
        <div className="col-span-2 flex flex-col gap-2">
          <p className="text-md text-muted-foreground">
            Nightwatch collects and preserves tweets and Telegram messages{" "}
            <span className="font-bold">from trusted blockchain sleuths</span>, acting as a curated and convenient
            searchable record of their work.
          </p>
          <p className="text-md text-muted-foreground">
            Use the search bar above to look up any mention of an actor, project, or anything else.
          </p>
        </div>
      </div>
    </div>
  );
};
