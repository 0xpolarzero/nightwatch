import { RemixServer } from "@remix-run/react";
import type { /* AppLoadContext, */ EntryContext } from "@remix-run/server-runtime";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server.browser";

import { ABORT_DELAY } from "~/lib/constants.server.ts";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  // loadContext: AppLoadContext,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ABORT_DELAY);

  const body = await renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
    {
      signal: controller.signal,
      onError(error: unknown) {
        if (!controller.signal.aborted) {
          // Log streaming rendering errors from inside the shell
          console.error(error);
        }
        responseStatusCode = 500;
      },
    },
  );

  body.allReady.then(() => clearTimeout(timeoutId));

  if (isbot(request.headers.get("user-agent") || "")) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
