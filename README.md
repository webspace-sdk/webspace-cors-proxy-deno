# Deno Deploy CORS Proxy

Serve any HTTPS endpoint with permissive CORS headers so that browsers can call the original API from client-side code.

## How It Works

Prefix the URL you want to reach with the proxy origin. The proxy forwards the request, strips the browser's `Origin` header (a common reason for 403 responses), and mirrors the downstream response while adding:

- `Access-Control-Allow-*` headers that echo requested methods and headers
- `Access-Control-Expose-Headers` so metadata like `Content-Length` and `Location` stays readable
- A rewritten `Location` when the upstream issues redirects so clients continue through the proxy

## Usage Example

```js
// Instead of doing this and hitting a CORS error …
const res = await fetch("https://api.example.com/data");

// … call the proxy with the destination URL appended
const proxied = await fetch("https://cors.deno.dev/https://api.example.com/data");
const data = await proxied.json();
```

## Local Development

1. Install [Deno](https://deno.land/manual@v2.4.5/getting_started/installation) 2.4.5 or newer.
2. From this directory run `deno task dev` to start a hot-reloading server on port 8000.
3. Visit [http://localhost:8000/https://api.example.com/health](http://localhost:8000/https://api.example.com/health) to verify it proxies correctly.

The server only requires network access and read access to `README.md`, which is reflected in the `deno.json` task definitions.

## Deploying to Deno Deploy

You can deploy directly from the command line or through the Deno Deploy dashboard.

### CLI deployment (recommended)

1. Authenticate once with `deno deploy login`.
2. Deploy the current directory: `deno deploy --project=cors-proxy --prod main.ts`.
   - Replace `cors-proxy` with your preferred project name. The command will create the project on first run.
3. After a successful deploy, Deno Deploy prints the production URL (for example `https://cors-proxy.deno.dev`). Use that origin in your client code.

### Dashboard deployment

1. Go to <https://dash.deno.com/new> and choose **GitHub** or **Manual** deployment.
2. Select this repository and point the entry point at `main.ts`.
3. Choose the **United States** or your preferred region and click **Deploy**. Updates push automatically whenever you commit to the selected branch.

## Testing Redirect Behaviour

Some APIs respond with 30x redirects. The proxy rewrites `Location` headers so that the browser follows the redirect through the proxy instead of going direct to the upstream domain. You can test this locally by requesting `https://cors.deno.dev/https://httpbin.org/redirect/1` and watching the request chain in your devtools network tab.

## Troubleshooting

- **403 or 5xx from upstream** – Check the proxy logs in Deno Deploy. The upstream API might require additional headers (e.g. API key). Add them to the original `fetch` call; the proxy forwards custom headers unchanged.
- **Slow responses** – The proxy streams the downstream body, so latency comes from the target server. Consider deploying the proxy in the same region as the upstream API.
- **Large uploads** – Deno Deploy currently limits request bodies to 10 MiB (as of September 27, 2025). Larger uploads will fail before reaching the upstream.

## License

MIT
