import { XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "~/components/ui/card.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "~/components/ui/dialog.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip.tsx";
import { useSearch } from "~/hooks/use-search.tsx";
import { DbAuthor, DbMediaType, DbMentionType, DbTweet, DbUrlType } from "~/lib/types.ts";
import { cn } from "~/lib/utils.ts";

export const Results = () => {
  const { result, query, isLoading } = useSearch();
  const memoizedQuery = useMemo(() => query, [isLoading]);

  const [selectedMedia, setSelectedMedia] = useState<DbMediaType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setSelectedMedia(null);
  };

  const groupedTweets = useMemo(() => {
    // Group tweets by conversation_id (or alone if no conversation_id)
    const grouped = result?.reduce(
      (acc, tweet) => {
        acc[tweet.conversation_id?.toString() || tweet.id.toString()] = [
          ...(acc[tweet.conversation_id?.toString() || tweet.id.toString()] || []),
          tweet,
        ];
        return acc;
      },
      {} as Record<string, Array<DbTweet>>,
    );

    return Object.values(grouped || {}).sort(
      (a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime(),
    );
  }, [result]);

  if (!result) return null;
  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <div className="flex flex-col gap-4 overflow-y-auto">
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          {groupedTweets.length} {groupedTweets.length === 1 ? "tweet" : "tweets"} ({result.length} including replies)
        </p>
        <div className="flex flex-col gap-4">
          {groupedTweets.map((tweets) => (
            <TweetCard
              key={tweets[0].id}
              tweets={tweets}
              query={memoizedQuery}
              setSelectedMedia={setSelectedMedia}
              setIsDialogOpen={setIsDialogOpen}
            />
          ))}
        </div>
      </div>

      <DialogContent
        className="max-h-[90vh] min-h-[90vh] min-w-[90vw] bg-transparent backdrop-blur-sm"
        closeButton={
          <Button variant="secondary" size="icon" className="size-5 cursor-pointer">
            <XIcon className="size-3" />
          </Button>
        }
      >
        <DialogTitle className="sr-only">Tweet Media</DialogTitle>
        <DialogDescription className="sr-only">Tweet Media</DialogDescription>
        {selectedMedia && (
          <div className="flex items-center justify-center overflow-auto">
            <TweetMedia media={selectedMedia} isThumbnail={false} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Helper function to format text using entities and highlight query
const formatText = (
  text: string,
  mentions: DbMentionType[] | null | undefined,
  urls: DbUrlType[] | null | undefined,
  query: string,
): JSX.Element => {
  // Decode HTML entities like &amp; to & before processing
  const decodedText = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

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
      nodes.push(decodedText.substring(lastIndex, entity.start_index));
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
          {decodedText.substring(entity.start_index, entity.end_index)}
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
  if (lastIndex < decodedText.length) nodes.push(decodedText.substring(lastIndex));

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
const TweetMedia = ({
  media,
  isThumbnail = false,
  onClick,
}: {
  media: DbMediaType;
  isThumbnail?: boolean;
  onClick?: () => void;
}) => {
  const commonClasses = cn(
    isThumbnail
      ? "w-auto h-64 overflow-hidden object-cover block max-w-[200px] cursor-pointer hover:scale-105 transition-all duration-200"
      : "w-auto max-h-[80vh] object-cover max-w-[1000px] ",
  );

  if (media.type === "photo") {
    return (
      <img
        src={media.url}
        aria-label="Tweet media"
        alt="Tweet media"
        className={commonClasses}
        width={media.width}
        height={media.height}
        loading="lazy"
        onClick={onClick}
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

// New reusable component for tweet headers
const TweetHeader = ({
  author,
  createdAt,
  url,
  isReply = false,
}: {
  author: DbAuthor;
  createdAt: string;
  url: string;
  isReply?: boolean;
}) => {
  // Format date to be more readable
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Tooltip>
      <div className={`flex items-center ${isReply ? "gap-2 text-sm" : "gap-3"}`}>
        <TooltipTrigger className="cursor-pointer" asChild>
          <Avatar className={cn(isReply && "size-6")}>
            <AvatarImage src={author.profile_picture_url} alt={author.display_name} />
            <AvatarFallback>{author.display_name.charAt(0)}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <div className="flex gap-1.5 items-center w-full">
          <TooltipTrigger className="cursor-pointer" asChild>
            <p
              className={`${isReply ? "text-xs" : ""} font-${isReply ? "medium" : "semibold"} text-gray-${isReply ? "800" : "900"} dark:text-${isReply ? "gray-200" : "white"}`}
            >
              {author.display_name}
            </p>
          </TooltipTrigger>
          <TooltipTrigger className="cursor-pointer" asChild>
            <p className="text-gray-500 dark:text-gray-400 text-xs">@{author.username}</p>
          </TooltipTrigger>
          <p className="text-gray-500 dark:text-gray-400 text-xs">·</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs flex-1">{formatDate(createdAt)}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:underline hover:text-link-foreground text-xs font-medium cursor-pointer"
          >
            View on Twitter
          </a>
        </div>
      </div>
      <TooltipContent className="bg-background border-1 border-gray-200 dark:border-gray-700 rounded-sm">
        <TwitterProfileCard author={author} />
      </TooltipContent>
    </Tooltip>
  );
};

const TwitterProfileCard = ({ author }: { author: DbAuthor }) => {
  return (
    <div className="flex flex-col gap-3 p-2 max-w-[300px]">
      {/* Header with avatar and follow counts */}
      <div className="flex items-center gap-3">
        <Avatar className="size-8">
          <AvatarImage src={author.profile_picture_url} alt={author.display_name} />
          <AvatarFallback>{author.display_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="font-bold text-gray-900 dark:text-gray-200 text-sm">{author.display_name}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs">@{author.username}</p>
        </div>
      </div>

      {/* Bio description */}
      {author.profile_bio?.description && (
        <p className="text-sm">
          {formatText(author.profile_bio.description, author.profile_bio.user_mentions, author.profile_bio.urls, "")}
        </p>
      )}

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex gap-1">
          <span className="font-semibold text-gray-900 dark:text-gray-200">{author.following.toLocaleString()}</span>
          <span className="text-gray-500 dark:text-gray-400">Following</span>
        </div>
        <div className="flex gap-1">
          <span className="font-semibold text-gray-900 dark:text-gray-200">{author.followers.toLocaleString()}</span>
          <span className="text-gray-500 dark:text-gray-400">Followers</span>
        </div>
      </div>
    </div>
  );
};

const TweetCard = ({
  tweets,
  query,
  setSelectedMedia,
  setIsDialogOpen,
}: {
  tweets: DbTweet[];
  query: string;
  setSelectedMedia: (media: DbMediaType) => void;
  setIsDialogOpen: (open: boolean) => void;
}) => {
  // Ensure there's at least one tweet
  if (!tweets || tweets.length === 0) return null;

  const mainTweet = tweets[0];
  const replies = tweets.slice(1);

  // Helper function to handle media click
  const handleMediaClick = (media: DbMediaType) => {
    setSelectedMedia(media);
    setIsDialogOpen(true);
  };

  return (
    <Card className="gap-2">
      {/* Header for the main tweet */}
      <CardHeader>
        <TweetHeader author={mainTweet.author} createdAt={mainTweet.created_at} url={mainTweet.url} />
      </CardHeader>

      {/* Content: Main tweet + media + replies */}
      <CardContent className="flex flex-col gap-4">
        {/* Use the updated formatText function for the main tweet */}
        {formatText(mainTweet.text, mainTweet.user_mentions, mainTweet.urls, query)}

        {/* Render Media Thumbnails for Main Tweet */}
        {mainTweet.medias && mainTweet.medias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mainTweet.medias.map((media, index) => (
              <DialogTrigger key={index} asChild>
                <div onClick={() => handleMediaClick(media)}>
                  <TweetMedia
                    media={media}
                    // deno-lint-ignore jsx-boolean-value
                    isThumbnail={true}
                  />
                </div>
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
                {/* Reply Header */}
                <TweetHeader
                  author={replyTweet.author}
                  createdAt={replyTweet.created_at}
                  url={replyTweet.url}
                  // deno-lint-ignore jsx-boolean-value
                  isReply={true}
                />

                {/* Reply Content */}
                {formatText(replyTweet.text, replyTweet.user_mentions, replyTweet.urls, query)}

                {/* Render Media Thumbnails for Reply Tweet */}
                {replyTweet.medias && replyTweet.medias.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {replyTweet.medias.map((media, index) => (
                      <DialogTrigger key={index} asChild>
                        <div onClick={() => handleMediaClick(media)}>
                          <TweetMedia
                            media={media}
                            // deno-lint-ignore jsx-boolean-value
                            isThumbnail={true}
                          />
                        </div>
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
  );
};
