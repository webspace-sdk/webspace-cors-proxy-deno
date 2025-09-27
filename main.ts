import { serve } from "@std/http/server";
import { CSS, render } from "@gfm";

const DEFAULT_ALLOWED_METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";

function upsertVary(headers: Headers, value: string) {
  const additions = value.split(",").map((part) => part.trim()).filter(Boolean);
  const existing = headers.get("Vary");

  if (!existing) {
    headers.set("Vary", additions.join(", "));
    return;
  }

  const varySet = new Set(
    existing.split(",").map((part) => part.trim()).filter(Boolean),
  );

  for (const addition of additions) {
    varySet.add(addition);
  }

  headers.set("Vary", Array.from(varySet).join(", "));
}

function applyCorsHeaders(
  request: Request,
  headersInit?: HeadersInit,
) {
  const headers = new Headers(headersInit);
  const requestedMethod = request.headers.get("Access-Control-Request-Method");
  const requestedHeaders = request.headers.get("Access-Control-Request-Headers");

  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    requestedMethod ? `${requestedMethod}, OPTIONS` : DEFAULT_ALLOWED_METHODS,
  );
  headers.set(
    "Access-Control-Allow-Headers",
    requestedHeaders ?? "*",
  );
  headers.set(
    "Access-Control-Expose-Headers",
    "Accept-Ranges, Content-Encoding, Content-Length, Content-Range, Location",
  );
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("X-Content-Type-Options", "nosniff");
  upsertVary(headers, "Origin, Access-Control-Request-Headers");

  return headers;
}

function isUrl(url: string) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function rewriteRedirectLocation(
  locationHeader: string,
  requestTargetUrl: string,
  proxyOrigin: string,
) {
  if (locationHeader.startsWith(`${proxyOrigin}/`)) {
    return null;
  }

  try {
    const resolvedTarget = new URL(requestTargetUrl);
    const resolvedLocation = new URL(locationHeader, resolvedTarget);
    const proxied = `${proxyOrigin}/${resolvedLocation.href}`;
    return proxied;
  } catch {
    return null;
  }
}

async function handleRequest(request: Request) {
  const url = new URL(request.url);
  const { pathname, search } = url;
  const targetUrl = pathname.substring(1) + search;

  if (isUrl(targetUrl)) {
    console.log("proxy to %s", targetUrl);
    const method = request.method.toUpperCase();
    const corsHeaders = applyCorsHeaders(request);

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("Origin");

    const response = await fetch(targetUrl, {
      headers: requestHeaders,
      method: request.method,
      redirect: "manual",
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      signal: request.signal,
    });

    const headers = applyCorsHeaders(request, response.headers);
    const redirectLocation = response.headers.get("location");

    if (redirectLocation) {
      const proxied = rewriteRedirectLocation(redirectLocation, targetUrl, url.origin);
      if (proxied) {
        headers.set("Location", proxied);
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const readme = await Deno.readTextFile("./README.md");
  const body = render(readme);
  const html = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CORS Proxy</title>
        <style>
          body {
            margin: 0;
            background-color: var(--color-canvas-default);
            color: var(--color-fg-default);
          }
          main {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem 1rem;
          }
          ${CSS}
        </style>
      </head>
      <body data-color-mode="auto" data-light-theme="light" data-dark-theme="dark">
        <main class="markdown-body">
          ${body}
        </main>
      </body>
    </html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=utf-8",
    },
  });
}

const port = Deno.env.get("PORT") ?? "8000";

serve(handleRequest, { port: Number(port) });
