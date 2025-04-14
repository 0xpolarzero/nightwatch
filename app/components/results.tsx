import { useMemo } from "react";

import { useSearch } from "~/hooks/use-search";
import { Tweet } from "~/lib/types";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";

// TODO: put all with same conversation_id in a card
// right now we can just figure out: if the tweet starts with @ (mention) (first tweet ignored), put it backwards
// put the first tweet forward, and same for any following tweet that doesn't start with @ (probably part of the same thread)
// later we might want to just use inReplyToUser to figure out if it's an answer to someone else but @ seems enough?

export const Results = () => {
  const { result, query, isLoading } = useSearch();
  const memoizedQuery = useMemo(() => query, [isLoading]);

  if (!result) return null;
  return (
    <div className="space-y-4 py-4">
      {result?.tweets.map((tweet) => <TweetCard key={tweet.id} tweet={tweet} query={memoizedQuery} />)}
    </div>
  );
};

const TweetCard = ({ tweet, query }: { tweet: Tweet; query: string }) => {
  // Format date to be more readable
  const formattedDate = new Date(tweet.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Highlight matching text in the tweet
  const highlightMatchingText = (text: string, query: string) => {
    if (!query || !query.trim()) return <p className="mt-1 text-gray-800 dark:text-gray-200">{text}</p>;

    try {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escapedQuery})`, "gi");
      const parts = text.split(regex);

      return (
        <p className="mt-1 text-gray-800 dark:text-gray-200">
          {parts.map((part, i) => {
            return part.toLowerCase() === query.toLowerCase() ? (
              <span key={i} className="bg-yellow-200 dark:bg-yellow-700">
                {part}
              </span>
            ) : (
              part
            );
          })}
        </p>
      );
    } catch (error) {
      // Fallback in case of regex error
      return <p className="mt-1 text-gray-800 dark:text-gray-200">{text}</p>;
    }
  };

  console.log(tweet);

  return (
    <Card className="flex flex-col gap-2">
      <CardHeader className="flex items-end gap-2 text-sm">
        <Avatar>
          <AvatarImage src={tweet.author.profile_picture_url} alt={tweet.author.name} />
          <AvatarFallback>{tweet.author.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="font-semibold text-gray-900 dark:text-white">{tweet.author.name}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs truncate ">@{tweet.author.username}</p>
        </div>
      </CardHeader>
      <CardContent>{highlightMatchingText(tweet.text, query)}</CardContent>
      <CardFooter className="flex gap-2">
        <p className="text-gray-500 dark:text-gray-400 text-xs">{formattedDate}</p>
        <p className="text-gray-500 dark:text-gray-400 text-xs">·</p>
        <a
          href={tweet.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link hover:underline hover:text-link-foreground text-sm font-medium cursor-pointer"
        >
          Open on Twitter
        </a>
      </CardFooter>
    </Card>
  );
};
