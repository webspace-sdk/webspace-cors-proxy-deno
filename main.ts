import { serve } from "https://deno.land/std@0.152.0/http/server.ts";
import { CSS, render } from "https://deno.land/x/gfm@0.1.22/mod.ts";

function addCorsIfNeeded(response: Response) {
  const headers = new Headers(response.headers);

  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Access-Control-Expose-Headers", "Accept-Ranges, Content-Encoding, Content-Length, Content-Range");
  headers.set('Vary', 'Origin')
  headers.set('X-Content-Type-Options', 'nosniff')

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

async function handleRequest(request: Request) {
  const url = new URL(request.url);
  const { pathname, search } = url;
  const targetUrl = pathname.substring(1) + search;

  if (isUrl(targetUrl)) {
    console.log("proxy to %s", targetUrl);
    const corsHeaders = addCorsIfNeeded(new Response());
    if (request.method.toUpperCase() === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('Origin') // Some domains disallow access from improper Origins
    
    const response = await fetch(targetUrl, {
      headers: requestHeaders,
      method: request.method,
      redirect: 'manual',
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy
    });
    
    const headers = addCorsIfNeeded(response);
    const proxyUrl = new URL(url.origin)
    const redirectLocation = headers.get('Location') || headers.get('location')
    
    if (redirectLocation) {
      if (!redirectLocation.startsWith('/')) {
        headers.set(
          'Location',
          proxyUrl.protocol + '//' + proxyUrl.host + '/' + redirectLocation
        )
      } else {
        const tUrl = new URL(targetUrl)
        headers.set(
          'Location',
          proxyUrl.protocol +
            '//' +
            proxyUrl.host +
            '/' +
            tUrl.origin +
            redirectLocation
        )
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
