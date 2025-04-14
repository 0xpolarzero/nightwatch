import { XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "~/components/ui/card.tsx";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog.tsx";
import { useSearch } from "~/hooks/use-search.tsx";
import { DbMediaType, DbMentionType, DbTweet, DbUrlType } from "~/lib/types.ts";

export const Results = () => {
  const { result, query, isLoading } = useSearch();
  const memoizedQuery = useMemo(() => query, [isLoading]);

  const groupedTweets = useMemo(() => {
    // Group tweets by conversation_id (or alone if no conversation_id)
    const grouped = result?.reduce((acc, tweet) => {
      acc[tweet.conversation_id?.toString() || tweet.id.toString()] = [
        ...(acc[tweet.conversation_id?.toString() || tweet.id.toString()] || []),
        tweet,
      ];
      return acc;
    }, {}) as Record<string, Array<DbTweet>>;

    return Object.values(grouped || {}).sort(
      (a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime(),
    );
  }, [result]);

  if (!result) return null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-gray-500 dark:text-gray-400 text-xs">
        {groupedTweets.length} {groupedTweets.length === 1 ? "tweet" : "tweets"} ({result.length} including replies)
      </p>
      <div className="flex flex-col gap-4">
        {groupedTweets.map((tweets) => (
          <TweetCard key={tweets[0].id} tweets={tweets} query={memoizedQuery} />
        ))}
      </div>
    </div>
  );
};

// Helper function to format text using entities and highlight query
const formatText = (
  text: string,
  mentions: DbMentionType[] | null | undefined,
  urls: DbUrlType[] | null | undefined,
  query: string,
): JSX.Element => {
  // 1. Combine and sort entities (mentions and URLs) by start index
  const entities: (DbMentionType | DbUrlType)[] = [...(mentions || []), ...(urls || [])].sort(
    (a, b) => a.start_index - b.start_index,
  );

  // 2. Build initial array of nodes (strings and links) based on entities
  const nodes: (string | JSX.Element)[] = [];
  let lastIndex = 0;

  entities.forEach((entity, i) => {
    // Add text segment before the entity
    if (entity.start_index > lastIndex) {
      nodes.push(text.substring(lastIndex, entity.start_index));
    }

    // Add the entity link
    if ("username" in entity) {
      // DbMentionType
      nodes.push(
        <a
          key={`mention-${i}-${entity.start_index}`}
          href={`https://twitter.com/${entity.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link hover:underline hover:text-link-foreground"
        >
          {text.substring(entity.start_index, entity.end_index)}
        </a>,
      );
    } else {
      // DbUrlType
      nodes.push(
        <a
          key={`url-${i}-${entity.start_index}`}
          href={entity.expanded_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link hover:underline hover:text-link-foreground"
        >
          {entity.display_url}
        </a>,
      );
    }
    lastIndex = entity.end_index;
  });

  // Add remaining text after the last entity
  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  // 3. Apply query highlighting to string nodes
  const finalNodes: (string | JSX.Element)[] = [];
  const queryRegex =
    query && query.trim() ? new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi") : null;

  nodes.forEach((node, i) => {
    if (typeof node === "string" && queryRegex) {
      const parts = node.split(queryRegex).filter(Boolean);
      parts.forEach((part, j) => {
        if (part.toLowerCase() === query.toLowerCase()) {
          finalNodes.push(
            <span key={`${i}-hl-${j}`} className="bg-yellow-200 dark:bg-yellow-700">
              {part}
            </span>,
          );
        } else {
          // Push part as is, preserving original casing
          finalNodes.push(part);
        }
      });
    } else {
      // Keep existing JSX elements (links) or strings if no query/highlighting needed
      finalNodes.push(node);
    }
  });

  return <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{finalNodes}</p>;
};

// Helper component to render media (with thumbnail option)
const TweetMedia = ({ media, isThumbnail = false }: { media: DbMediaType; isThumbnail?: boolean }) => {
  const commonClasses = isThumbnail ? "w-auto h-64 object-cover block" : "w-full h-auto object-cover";

  if (media.type === "photo") {
    return (
      <img
        src={media.url}
        alt="Tweet media"
        className={commonClasses}
        width={media.width}
        height={media.height}
        loading="lazy"
      />
    );
  }

  if (media.type === "video" || media.type === "animated_gif") {
    // Use poster for thumbnail view if available and requested
    const posterUrl = isThumbnail ? media.url : undefined;
    return (
      <video
        controls={!isThumbnail} // Only show controls when not a thumbnail (in the dialog)
        muted // Mute by default
        loop={media.type === "animated_gif"}
        playsInline // Important for mobile browsers
        src={media.url}
        poster={posterUrl} // Use preview image as poster for thumbnail
        className={commonClasses}
        width={media.width}
        height={media.height}
        preload={isThumbnail ? "metadata" : "auto"} // Preload less for thumbnail
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  return null; // Handle unknown media types if necessary
};

const TweetCard = ({ tweets, query }: { tweets: DbTweet[]; query: string }) => {
  // Ensure there's at least one tweet
  if (!tweets || tweets.length === 0) {
    return null;
  }

  const mainTweet = tweets[0];
  const replies = tweets.slice(1);

  // State for managing the single media dialog per card
  const [selectedMedia, setSelectedMedia] = useState<DbMediaType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Function to handle closing the dialog and clearing the selected media
  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setSelectedMedia(null);
  };

  // Format date to be more readable
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    // Wrap the Card and DialogContent in a single Dialog, controlled by state
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <Card className="gap-2">
        {/* Header for the main tweet */}
        <CardHeader className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={mainTweet.author.profile_picture_url} alt={mainTweet.author.display_name} />
            <AvatarFallback>{mainTweet.author.display_name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex gap-2 items-center w-full">
            <p className="font-semibold text-gray-900 dark:text-white">{mainTweet.author.display_name}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">@{mainTweet.author.username}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">·</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs flex-1">{formatDate(mainTweet.created_at)}</p>
            <a
              href={mainTweet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:underline hover:text-link-foreground text-xs font-medium cursor-pointer"
            >
              View on Twitter
            </a>
          </div>
        </CardHeader>

        {/* Content: Main tweet + media + replies */}
        <CardContent className="flex flex-col gap-4">
          {/* Use the updated formatText function for the main tweet */}
          {formatText(mainTweet.text, mainTweet.user_mentions, mainTweet.urls, query)}

          {/* Render Media Thumbnails for Main Tweet */}
          {mainTweet.medias && mainTweet.medias.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {mainTweet.medias.map((media, index) => (
                // Use DialogTrigger wrapping a button that sets state onClick
                <DialogTrigger key={index} asChild>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedMedia(media)} // Set media before trigger opens dialog
                    className="overflow-hidden rounded-lg max-w-[200px] cursor-pointer hover:scale-105 transition-all duration-200"
                    aria-label={`View media ${index + 1}`}
                    asChild
                  >
                    <TweetMedia media={media} isThumbnail={true} />
                  </Button>
                </DialogTrigger>
              ))}
            </div>
          )}

          {/* Replies section */}
          {replies.length > 0 && (
            <div className="flex flex-col gap-4 border-gray-200 dark:border-gray-700 text-sm border-l pl-4">
              {/* Indented replies */}
              {replies.map((replyTweet) => (
                <div key={replyTweet.id} className="flex flex-col gap-2">
                  {" "}
                  {/* Added gap */}
                  {/* Reply Header */}
                  <div className="flex flex-row items-center gap-2 text-sm">
                    <Avatar className="size-6">
                      {/* Smaller avatar for replies */}
                      <AvatarImage src={replyTweet.author.profile_picture_url} alt={replyTweet.author.display_name} />
                      <AvatarFallback>{replyTweet.author.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1.5 flex-1">
                      <p className="font-medium text-gray-800 dark:text-gray-200 text-xs">
                        {replyTweet.author.display_name}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">@{replyTweet.author.username}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">·</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs flex-1">
                        {formatDate(replyTweet.created_at)}
                      </p>
                      <a
                        href={replyTweet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link hover:underline hover:text-link-foreground text-xs font-medium cursor-pointer"
                      >
                        View on Twitter
                      </a>
                    </div>
                  </div>
                  {/* Reply Content */}
                  {formatText(replyTweet.text, replyTweet.user_mentions, replyTweet.urls, query)}
                  {/* Render Media Thumbnails for Reply Tweet */}
                  {replyTweet.medias && replyTweet.medias.length > 0 && (
                    // Use flex-wrap for consistent layout
                    <div className="flex flex-wrap gap-2">
                      {replyTweet.medias.map((media, index) => (
                        <DialogTrigger key={index} asChild>
                          <Button
                            variant="ghost"
                            onClick={() => setSelectedMedia(media)}
                            className="overflow-hidden rounded-lg max-w-[150px] cursor-pointer hover:scale-105 transition-all duration-200"
                            aria-label={`View reply media ${index + 1}`}
                          >
                            <TweetMedia media={media} isThumbnail={true} />
                          </Button>
                        </DialogTrigger>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DialogContent
        className="max-w-fit max-h-[95vh] overflow-auto p-0 border-none bg-transparent"
        closeButton={
          <Button variant="secondary" size="icon" className="size-5 cursor-pointer">
            <XIcon className="size-3" />
          </Button>
        }
      >
        <DialogTitle className="sr-only">Tweet Media</DialogTitle>
        {selectedMedia && <TweetMedia media={selectedMedia} isThumbnail={false} />}
      </DialogContent>
    </Dialog>
  );
};
