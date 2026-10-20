import http from "node:http";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import pc from "picocolors";

declare const __VERSION__: string;

/**
 * Escape a string for safe interpolation into HTML text content.
 *
 * Used for server/browser-supplied error messages so they cannot inject
 * markup or script into the local callback page.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Create a PKCE verifier/challenge pair (RFC 7636, S256).
 *
 * The verifier is 32 bytes of randomness encoded as base64url (43 chars);
 * the challenge is BASE64URL(SHA256(verifier)). Only the challenge ever
 * leaves the machine during step 2 — the verifier is kept local and sent
 * once, over a back-channel HTTPS request, to redeem the authorization code.
 */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return { verifier, challenge };
}

export type CallbackResult =
  /** v1.6.0 PKCE flow: a one-time authorization code to be exchanged. */
  | { code: string }
  /** Legacy v1.5.0 flow: the API key was sent directly in the callback URL. */
  | { apiKey: string };

/**
 * Validate the OAuth callback payload returned by the browser.
 *
 * Extracted as a pure function so it can be unit-tested without binding sockets.
 *
 * The v1.6.0 flow yields a short-lived authorization `code`; the API key is
 * retrieved separately via `exchangeCodeForApiKey`. The legacy `api_key`/`token`
 * parameters are still accepted as a fallback so that CLI builds released
 * before the PKCE rollout keep working against older servers — this fallback
 * can be dropped once the minimum server version requires PKCE.
 *
 * @throws {Error} when the state mismatches, the server reports an error, or
 * neither an authorization code nor a legacy API key is present.
 */
export function handleCallback(
  params: URLSearchParams,
  expectedState: string
): CallbackResult {
  const receivedState = params.get("state");
  const code = params.get("code");
  const legacyApiKey = params.get("api_key") || params.get("token");
  const error = params.get("error");

  if (receivedState !== expectedState) {
    throw new Error("State mismatch. Possible CSRF attempt — please try again.");
  }

  if (error) {
    throw new Error(error);
  }

  if (code) {
    return { code };
  }

  if (legacyApiKey) {
    return { apiKey: legacyApiKey };
  }

  throw new Error("No authorization code returned by the server.");
}

export interface TokenResponse {
  api_key: string;
  name: string;
  masked_key: string;
}

/**
 * Exchange a one-time authorization code plus its PKCE verifier for the API key.
 *
 * This is a direct back-channel request from the CLI to the NeedMCP backend —
 * the key is only ever returned in the JSON body, never in a browser URL.
 */
export async function exchangeCodeForApiKey(
  baseUrl: string,
  code: string,
  codeVerifier: string,
  callbackUrl: string
): Promise<string> {
  const tokenUrl = `${baseUrl.replace(/\/+$/, "")}/oauth/cli/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": `needmcp-cli/${typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0"}`,
    },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      callback_url: callbackUrl,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Too many authentication attempts. Please wait a minute and try again."
      );
    }

    let errorMessage = `Token exchange failed with status ${response.status}`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) {
        errorMessage = data.message;
      }
    } catch {
      // Body was not JSON — keep the generic status message.
    }

    throw new Error(errorMessage);
  }

  const result = (await response.json()) as TokenResponse;
  if (!result.api_key) {
    throw new Error("Server response did not contain an API key.");
  }

  return result.api_key;
}

/**
 * Build the argv used to hand a URL to the Windows default browser.
 *
 * `execFile` avoids the shell, but `cmd.exe /c` is itself a command
 * interpreter: it re-parses its argument string and treats a bare `&` as a
 * command separator. Left unescaped, `start` receives only the URL prefix up
 * to the first `&` and silently drops every later query parameter — which in
 * the OAuth flow means losing `code_challenge` and downgrading the request to
 * the disabled legacy flow.
 *
 * Caret escaping (`&` -> `^&`) is the form `cmd.exe` actually honours here.
 * Wrapping the URL in double quotes does not work, because the caret is
 * consumed by the parser before quoting is applied.
 *
 * The leading empty string is the window title `start` expects.
 */
export function buildWindowsOpenArgs(url: string): string[] {
  return ["/c", "start", "", url.replace(/&/g, "^&")];
}

/**
 * Open a URL in the user's default browser across platforms.
 */
function openBrowser(url: string): void {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  let file: string;
  let args: string[];
  if (isWin) {
    file = "cmd.exe";
    args = buildWindowsOpenArgs(url);
  } else if (isMac) {
    file = "open";
    args = [url];
  } else {
    file = "xdg-open";
    args = [url];
  }

  execFile(file, args, (err) => {
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
    <p>${escapeHtml(message)}</p>
  </body>
</html>`;
}

/**
 * Perform the OAuth CLI login flow via a local HTTP listener.
 *
 * Opens the browser to `${baseUrl}/oauth/cli` with a PKCE challenge, waits for
 * the browser to redirect back to `http://127.0.0.1:<port>/callback` with a
 * one-time authorization code, then exchanges that code (plus the locally kept
 * verifier) for the API key over a direct HTTPS request. Resolves with the key.
 */
export function loginWithOAuth(baseUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString("hex");
    const { verifier, challenge } = generatePkce();
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      server.close();
      fn();
    };

    const server = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url || "/", `http://${req.headers.host}`);

      if (parsedUrl.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      try {
        const result = handleCallback(parsedUrl.searchParams, state);

        // PKCE flow: the callback only carries a one-time code. Redeem it here
        // before writing the page so a failed exchange still renders the error
        // page instead of a misleading success screen.
        let apiKey: string;
        if ("code" in result) {
          const address = server.address();
          const port = typeof address === "object" && address ? address.port : 0;
          const callbackUrl = `http://127.0.0.1:${port}/callback`;

          apiKey = await exchangeCodeForApiKey(baseUrl, result.code, verifier, callbackUrl);
        } else {
          apiKey = result.apiKey;
        }

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
      const authUrl =
        `${baseUrl}/oauth/cli?callback=${encodeURIComponent(callbackUrl)}` +
        `&state=${state}&client=NeedMCP+CLI` +
        `&code_challenge=${challenge}&code_challenge_method=S256`;

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
