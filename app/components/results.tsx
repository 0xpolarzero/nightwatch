import { PaperclipIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "~/components/ui/card.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog.tsx";
import { Skeleton } from "~/components/ui/skeleton.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip.tsx";
import { useSearch } from "~/hooks/use-search.tsx";
import {
  DbMediaType,
  DbMentionType,
  DbTelegramChannel,
  DbTelegramMessage,
  DbTweet,
  DbTwitterUser,
  DbUrlType,
} from "~/lib/types.ts";
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

  // Group tweets by conversation_id (or alone if no conversation_id)
  const groupedTweets = useMemo(() => {
    if (!result?.tweets) return []; // Handle case where tweets might be undefined
    return Object.values(
      result.tweets.reduce(
        (acc, tweet) => {
          // Use conversation_id as the primary key, fallback to tweet id
          const key = tweet.conversation_id?.toString() || tweet.id.toString();
          acc[key] = [...(acc[key] || []), { ...tweet, type: "tweet" }];
          return acc;
        },
        {} as Record<string, Array<DbTweet & { type: "tweet" }>>,
      ),
    );
  }, [result?.tweets]); // Depend specifically on tweets

  // Group Telegram messages by thread_id (or alone if no thread_id)
  const groupedTgMessages = useMemo(() => {
    if (!result?.tgMessages) return []; // Handle case where tgMessages might be undefined
    return Object.values(
      result.tgMessages.reduce(
        (acc, message) => {
          // Use thread_id as the primary key, fallback to message id
          // Ensure thread_id is treated as string for keys
          const key = message.thread_id?.toString() || message.id.toString();
          acc[key] = [...(acc[key] || []), { ...message, type: "tgMessage" }];
          return acc;
        },
        {} as Record<string, Array<DbTelegramMessage & { type: "tgMessage" }>>, // Use DbTelegramMessage type
      ),
    );
  }, [result?.tgMessages]); // Depend specifically on tgMessages

  const allResults = [...groupedTweets, ...groupedTgMessages].sort(
    (a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime(),
  );

  if (result?.error) return <div className="flex justify-center text-destructive font-medium mt-4">{result.error}</div>;
  if (isLoading)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
    );
  if (!result || !allResults.length) return null;
  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <div className="flex flex-col gap-4 overflow-y-auto">
        {/* Display counts - adjust as needed */}
        <p className="text-gray-500 dark:text-gray-400 text-xs">
          Found {groupedTweets.length} {groupedTweets.length <= 1 ? "tweet" : "tweets"} ({result.tweets.length}{" "}
          including user replies), {groupedTgMessages.length}{" "}
          {groupedTgMessages.length <= 1 ? "Telegram message" : "Telegram messages"} ({result.tgMessages.length}{" "}
          including reply context).
        </p>
        <div className="flex flex-col gap-4">
          {allResults.map((result) =>
            result[0].type === "tweet" ? (
              <TweetCard
                key={result[0].id}
                tweets={result as Array<DbTweet>}
                query={memoizedQuery}
                setSelectedMedia={setSelectedMedia}
                setIsDialogOpen={setIsDialogOpen}
              />
            ) : result[0].type === "tgMessage" ? (
              <TelegramMessageCard
                key={result[0].id}
                messages={result as Array<DbTelegramMessage>}
                query={memoizedQuery}
              />
            ) : null,
          )}
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
        <DialogTitle className="sr-only">Media Viewer</DialogTitle>
        <DialogDescription className="sr-only">Media Viewer</DialogDescription>
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
  className?: string,
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
          className={cn("text-link hover:underline hover:text-link-foreground", className)}
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
          className={cn("text-link hover:underline hover:text-link-foreground", className)}
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

  return (
    <p className={cn("text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words", className)}>{finalNodes}</p>
  );
};

// Helper component to render media (with thumbnail option)
const TweetMedia = ({
  media,
  isThumbnail = false,
  redirectUrl,
}: {
  media: DbMediaType;
  isThumbnail?: boolean;
  onClick?: () => void;
  redirectUrl?: string;
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
      />
    );
  }

  if (media.type === "animated_gif") {
    return (
      <video
        controls={!isThumbnail}
        muted
        loop
        playsInline
        src={media.url}
        className={commonClasses}
        width={media.width}
        height={media.height}
        preload={isThumbnail ? "metadata" : "auto"}
      />
    );
  }

  // TODO: We can include the media.video_info.variants in the database to play videos
  if (media.type === "video") {
    return (
      <div className="relative">
        <a href={redirectUrl} target="_blank" rel="noopener noreferrer" className={cn(commonClasses, "group")}>
          <img
            src={media.url}
            aria-label="Tweet media"
            alt="Tweet media"
            className={commonClasses}
            width={media.width}
            height={media.height}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="absolute text-gray-200 text-xs font-medium text-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Watch video on Twitter
          </span>
        </a>
      </div>
    );

    // Use poster for thumbnail view if available and requested
    // const posterUrl = isThumbnail ? media.url : undefined;
    // return (
    //   <video
    //     controls={!isThumbnail}
    //     muted
    //     playsInline // Important for mobile browsers
    //     src={media.url}
    //     poster={posterUrl} // Use preview image as poster for thumbnail
    //     className={commonClasses}
    //     width={media.width}
    //     height={media.height}
    //     preload={isThumbnail ? "metadata" : "auto"} // Preload less for thumbnail
    //   >
    //     Your browser does not support the video tag.
    //   </video>
    // );
  }

  return null; // Handle unknown media types if necessary
};

// New reusable component for tweet headers
const TweetHeader = ({
  user,
  createdAt,
  url,
  isReply = false,
}: {
  user: DbTwitterUser;
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
            <AvatarImage src={user.profile_picture_url} alt={user.display_name} />
            <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <div className="grid grid-cols-[auto_1fr] sm:flex gap-x-1.5 items-center w-full">
          <TooltipTrigger className="cursor-pointer" asChild>
            <p
              className={`${isReply ? "text-xs" : ""} font-${isReply ? "medium" : "semibold"} text-gray-${isReply ? "800" : "900"} dark:text-gray-${isReply ? "400" : "200"}`}
            >
              {user.display_name}
            </p>
          </TooltipTrigger>
          <TooltipTrigger className="cursor-pointer" asChild>
            <p className="text-gray-500 dark:text-gray-400 text-xs">@{user.username}</p>
          </TooltipTrigger>
          <p className="hidden sm:block text-gray-500 dark:text-gray-400 text-xs">·</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs flex-1">{formatDate(createdAt)}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-3 text-link hover:underline hover:text-link-foreground text-xs font-medium cursor-pointer"
          >
            View on Twitter
          </a>
        </div>
      </div>
      <TooltipContent className="bg-background border-1 border-gray-200 dark:border-gray-700 rounded-sm">
        <TwitterProfileCard user={user} />
      </TooltipContent>
    </Tooltip>
  );
};

const TwitterProfileCard = ({ user }: { user: DbTwitterUser }) => {
  return (
    <div className="flex flex-col gap-3 p-2 max-w-[300px]">
      {/* Header with avatar and follow counts */}
      <div className="flex items-center gap-3">
        <Avatar className="size-8">
          <AvatarImage src={user.profile_picture_url} alt={user.display_name} />
          <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="font-bold text-gray-900 dark:text-gray-200 text-sm">{user.display_name}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs">@{user.username}</p>
        </div>
      </div>

      {/* Bio description */}
      {user.profile_bio?.description && (
        <p className="text-sm">
          {formatText(user.profile_bio.description, user.profile_bio.user_mentions, user.profile_bio.url_mentions, "")}
        </p>
      )}

      {/* Links */}
      {user.profile_bio?.urls && user.profile_bio?.urls.length > 0 && (
        <div className="flex flex-col gap-2">
          {user.profile_bio.urls.map((url) => (
            <a
              href={url.expanded_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:underline hover:text-link-foreground text-xs font-medium cursor-pointer"
            >
              {url.display_url}
            </a>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex gap-1">
          <span className="font-semibold text-gray-900 dark:text-gray-200">{user.following.toLocaleString()}</span>
          <span className="text-gray-500 dark:text-gray-400">Following</span>
        </div>
        <div className="flex gap-1">
          <span className="font-semibold text-gray-900 dark:text-gray-200">{user.followers.toLocaleString()}</span>
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
    if (media.type === "video") return;
    setSelectedMedia(media);
    setIsDialogOpen(true);
  };

  return (
    <Card className="gap-2 py-4 sm:py-6">
      {/* Header for the main tweet */}
      <CardHeader>
        <TweetHeader user={mainTweet.user} createdAt={mainTweet.created_at} url={mainTweet.url} />
      </CardHeader>

      {/* Content: Main tweet + media + replies */}
      <CardContent className="flex flex-col gap-4 px-4 sm:px-6">
        {/* Use the updated formatText function for the main tweet */}
        {formatText(mainTweet.text, mainTweet.user_mentions, mainTweet.urls, query)}

        {/* Render Media Thumbnails for Main Tweet */}
        {mainTweet.medias && mainTweet.medias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mainTweet.medias.map((media, index) => (
              <div key={index} onClick={() => handleMediaClick(media)}>
                <TweetMedia
                  media={media}
                  // deno-lint-ignore jsx-boolean-value
                  isThumbnail={true}
                  redirectUrl={mainTweet.url}
                />
              </div>
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
                  user={replyTweet.user}
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
                      <div key={index} onClick={() => handleMediaClick(media)}>
                        <TweetMedia
                          media={media}
                          // deno-lint-ignore jsx-boolean-value
                          isThumbnail={true}
                          redirectUrl={replyTweet.url}
                        />
                      </div>
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

// Profile card for Telegram channels (shown in tooltip)
const TelegramChannelProfileCard = ({ channel }: { channel: DbTelegramChannel }) => {
  // Function to get initials from title
  const getInitials = (title: string) => {
    return title
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="flex flex-col gap-2 max-w-[300px]">
      <div className="flex items-center gap-3 p-2">
        {/* Header with avatar and name */}
        <Avatar className="bg-blue-500 text-white">
          {/* Placeholder for potential future channel image */}
          {/* <AvatarImage src={channel.profile_picture_url} alt={channel.title} /> */}
          <AvatarFallback>{getInitials(channel.title)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="font-bold text-gray-500 dark:text-gray-200 text-sm">{channel.title}</p>
          {channel.channel_username && (
            <p className="text-gray-500 dark:text-gray-400 text-xs">@{channel.channel_username}</p>
          )}
        </div>
      </div>
      {formatText(channel.about, [], [], "")}
      <div className="text-gray-500 dark:text-gray-400 text-xs">
        Moderated by{" "}
        {channel.admin_usernames.map((admin) => (
          <a
            key={admin}
            href={`https://t.me/${admin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:underline hover:text-link-foreground"
          >
            @{admin}
          </a>
        ))}
      </div>
    </div>
  );
};

// Reusable header component for Telegram messages
const TelegramMessageHeader = ({
  channel,
  createdAt,
  url,
  isReply = false,
}: {
  channel: DbTelegramChannel;
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
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Get the first letter of each word in the title
  const getInitials = (title: string) => {
    return title
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <Tooltip>
      <div className={`flex items-center ${isReply ? "gap-2 text-sm" : "gap-3"}`}>
        {!isReply && (
          <TooltipTrigger className="cursor-pointer" asChild>
            <Avatar className="bg-link-foreground text-white size-10">
              {/* Placeholder for potential future channel image */}
              {/* <AvatarImage src={channel.profile_picture_url} alt={channel.title} /> */}
              <AvatarFallback className="bg-transparent">{getInitials(channel.title)}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>
        )}
        <div className="flex flex-col sm:flex-row gap-x-1.5 sm:items-center w-full">
          <TooltipTrigger className="cursor-pointer" asChild>
            <p
              className={`${isReply ? "text-xs" : ""} font-${isReply ? "medium" : "semibold"} text-gray-${isReply ? "700" : "900"} dark:text-gray-${isReply ? "400" : "200"}`}
            >
              {channel.title}
            </p>
          </TooltipTrigger>
          {channel.channel_username && (
            <TooltipTrigger className="cursor-pointer" asChild>
              <p className="text-gray-500 dark:text-gray-400 text-xs">@{channel.channel_username}</p>
            </TooltipTrigger>
          )}
          <p className="hidden sm:block text-gray-500 dark:text-gray-400 text-xs">·</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs flex-1">{formatDate(createdAt)}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:underline hover:text-link-foreground text-xs font-medium cursor-pointer"
          >
            View on Telegram
          </a>
        </div>
      </div>
      <TooltipContent className="bg-background border-1 border-gray-200 dark:border-gray-700 rounded-sm">
        <TelegramChannelProfileCard channel={channel} />
      </TooltipContent>
    </Tooltip>
  );
};

// Card component for displaying a Telegram message thread
const TelegramMessageCard = ({ messages, query }: { messages: DbTelegramMessage[]; query: string }) => {
  // Ensure there's at least one message and messages are sorted chronologically
  // The grouping logic now sorts messages before grouping.
  if (!messages || messages.length === 0) return null;

  const mainMessage = messages[0];
  const replies = messages.slice(1);

  console.log(messages);

  return (
    <Card className="gap-2">
      {/* Header for the main message */}
      <CardHeader>
        <TelegramMessageHeader channel={mainMessage.channel} createdAt={mainMessage.created_at} url={mainMessage.url} />
      </CardHeader>

      {/* Content: Main message + media alert + replies */}
      <CardContent className="flex flex-col gap-4">
        {/* Use the formatText function for the main message */}
        {formatText(mainMessage.message, [], mainMessage.urls, query)}

        {/* Media Alert for Main Message */}
        {mainMessage.has_media && (
          <a
            href={mainMessage.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-link hover:underline"
          >
            <PaperclipIcon className="size-3" />
            Media attached (view on Telegram)
          </a>
        )}

        {/* Replies section */}
        {replies.length > 0 && (
          <div className="flex flex-col gap-4 border-gray-200 dark:border-gray-700 text-sm border-l pl-4">
            {/* Indented replies */}
            {replies.map((replyMessage) => (
              <div key={replyMessage.id} className="flex flex-col gap-2">
                {/* Reply Header */}
                <TelegramMessageHeader
                  channel={replyMessage.channel}
                  createdAt={replyMessage.created_at}
                  url={replyMessage.url}
                  // deno-lint-ignore jsx-boolean-value
                  isReply={true}
                />

                {/* Reply Content */}
                {formatText(replyMessage.message, [], replyMessage.urls, query)}

                {/* Media Alert for Reply Message */}
                {replyMessage.has_media && (
                  <a
                    href={replyMessage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-link hover:underline"
                  >
                    <PaperclipIcon className="size-3" />
                    Media attached (view on Telegram)
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
