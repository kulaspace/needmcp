import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import pc from "picocolors";

export interface CallbackResult {
  apiKey: string;
}

/**
 * Validate the OAuth callback payload returned by the browser.
 *
 * Extracted as a pure function so it can be unit-tested without binding sockets.
 * @throws {Error} when the state mismatches or no API key/error is present.
 */
export function handleCallback(
  params: URLSearchParams,
  expectedState: string
): CallbackResult {
  const receivedState = params.get("state");
  const apiKey = params.get("api_key") || params.get("token");
  const error = params.get("error");

  if (receivedState !== expectedState) {
    throw new Error("State mismatch. Possible CSRF attempt — please try again.");
  }

  if (error) {
    throw new Error(error);
  }

  if (!apiKey) {
    throw new Error("No API key returned by the server.");
  }

  return { apiKey };
}

/**
 * Open a URL in the user's default browser across platforms.
 */
function openBrowser(url: string): void {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  let cmd: string;
  if (isWin) {
    // `start` needs an empty title argument to handle URLs with & correctly.
    cmd = `start "" "${url}"`;
  } else if (isMac) {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (err) => {
    // Failures are non-fatal: the URL is always printed as a fallback.
    if (err) {
      // Ignored — user can open the printed URL manually.
    }
  });
}

function successPage(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>NeedMCP CLI - Authenticated</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { background: #161616; border: 1px solid #27272a; border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      h1 { color: #10b981; font-size: 20px; margin-bottom: 8px; }
      p { color: #a1a1aa; font-size: 14px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>&#10003; Authentication Successful!</h1>
      <p>You may now close this browser tab and return to your terminal.</p>
    </div>
    <script>setTimeout(() => window.close(), 3000);</script>
  </body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>NeedMCP CLI - Authentication Failed</title></head>
  <body style="font-family: sans-serif; background:#0a0a0a; color:#fff; text-align:center; padding-top:80px;">
    <h1 style="color:#ef4444;">Authentication Failed</h1>
    <p>${message}</p>
  </body>
</html>`;
}

/**
 * Perform the OAuth CLI login flow via a local HTTP listener.
 *
 * Opens the browser to `${baseUrl}/oauth/cli`, waits for the browser to redirect
 * back to `http://127.0.0.1:<port>/callback` with the generated API key, then
 * resolves with that key.
 */
export function loginWithOAuth(baseUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString("hex");
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      server.close();
      fn();
    };

    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", `http://${req.headers.host}`);

      if (parsedUrl.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      try {
        const { apiKey } = handleCallback(parsedUrl.searchParams, state);

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(successPage());

        finish(() => resolve(apiKey));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(errorPage(message));

        finish(() => reject(new Error(message)));
      }
    });

    server.on("error", (err) => {
      finish(() => reject(err));
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        finish(() => reject(new Error("Failed to bind local server")));
        return;
      }

      const port = address.port;
      const callbackUrl = `http://127.0.0.1:${port}/callback`;
      const authUrl = `${baseUrl}/oauth/cli?callback=${encodeURIComponent(callbackUrl)}&state=${state}&client=NeedMCP+CLI`;

      console.log();
      console.log(pc.cyan("→ Opening your browser to authenticate with NeedMCP..."));
      console.log(pc.dim("  If your browser does not open automatically, visit:"));
      console.log(`  ${pc.underline(authUrl)}`);
      console.log();

      openBrowser(authUrl);
    });

    // Abort after 2 minutes of inactivity.
    server.setTimeout(120000, () => {
      finish(() => reject(new Error("Authentication timed out. Please try again.")));
    });
  });
}
