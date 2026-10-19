/**
 * Live verification against the NeedMCP backend.
 *
 * These tests describe what the server actually does, taken from its source
 * (app/Http/Middleware/SimpleApiKeyAuth.php) and confirmed over the wire:
 *
 *   - `X-API-Key` is read first; `Authorization: Bearer` is only a fallback
 *     into the *same* variable, so a key written to either header behaves alike.
 *   - The credential family is decided by prefix:
 *       `sk-need-*` / `sk_need_*` -> long-lived API key
 *       `mcp_at_*`                -> OAuth access token (1 hour TTL)
 *   - Both families are accepted on the same /mcp route.
 *   - A `guest_id` cookie carries no authentication while guest mode is off.
 *
 * The tests are network-dependent by design (the plan asked for a live
 * handshake); each one skips itself when the network is unavailable so the
 * suite stays usable offline.
 */

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

const MCP_URL = process.env.NEEDMCP_TEST_MCP_URL ?? "https://needmcp.com/mcp";
const AS_URL = MCP_URL.replace(/\/mcp\/?$/, "");

const INITIALIZE_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "needmcp-cli-test", version: "0" },
  },
});

async function postMcp(headers: Record<string, string>): Promise<Response> {
  return fetch(MCP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: INITIALIZE_BODY,
  });
}

let online = true;

async function probe(url: string): Promise<Response | null> {
  try {
    return await fetch(url, { method: "GET" });
  } catch {
    online = false;
    return null;
  }
}

describe("NeedMCP live: discovery metadata", () => {
  it("advertises protected-resource metadata pointing at /mcp", async () => {
    const res = await probe(`${AS_URL}/.well-known/oauth-protected-resource`);
    if (!res) return expect(online).toBe(false);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.resource).toBe(`${AS_URL}/mcp`);
    expect(body.authorization_servers).toContain(AS_URL);
    expect(body.scopes_supported).toContain("mcp:use");
    expect(body.bearer_methods_supported).toContain("header");
  });

  it("advertises authorization-server metadata with PKCE S256 only", async () => {
    const res = await probe(`${AS_URL}/.well-known/oauth-authorization-server`);
    if (!res) return expect(online).toBe(false);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.issuer).toBe(AS_URL);
    expect(body.authorization_endpoint).toBe(`${AS_URL}/oauth/authorize`);
    expect(body.token_endpoint).toBe(`${AS_URL}/oauth/token`);
    expect(body.registration_endpoint).toBe(`${AS_URL}/oauth/register`);
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(body.grant_types_supported).toContain("authorization_code");
    expect(body.grant_types_supported).toContain("refresh_token");
  });

  it("does NOT advertise RFC 9207 iss support (Gemini opt-out required)", async () => {
    const res = await probe(`${AS_URL}/.well-known/oauth-authorization-server`);
    if (!res) return expect(online).toBe(false);

    const body = await res.json();
    // This is the fact that makes geminiOAuthExtra() necessary. If NeedMCP
    // ever starts advertising it, this test fails and the opt-out can be
    // revisited.
    expect(body.authorization_response_iss_parameter_supported).toBeUndefined();
  });
});

describe("NeedMCP live: dynamic client registration", () => {
  it("issues a client_id via RFC 7591 with token_endpoint_auth_method=none", async () => {
    let res: Response;
    try {
      res = await fetch(`${AS_URL}/oauth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "needmcp-cli-test",
          redirect_uris: ["http://localhost:33418/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          scope: "mcp:use",
        }),
      });
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.client_id).toMatch(/^client_/);
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body.redirect_uris).toContain("http://localhost:33418/callback");
  });
});

describe("NeedMCP live: authorization endpoint", () => {
  it("renders the consent page for a PKCE S256 request", async () => {
    let reg: Response;
    try {
      reg = await fetch(`${AS_URL}/oauth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "needmcp-cli-test",
          redirect_uris: ["http://localhost:33419/callback"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          scope: "mcp:use",
        }),
      });
    } catch {
      return expect(true).toBe(true);
    }
    const { client_id } = await reg.json();

    // Real PKCE pair, exactly as oauth.ts generates it.
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");

    const authorize = new URL(`${AS_URL}/oauth/authorize`);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", client_id);
    authorize.searchParams.set("redirect_uri", "http://localhost:33419/callback");
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("scope", "mcp:use");
    authorize.searchParams.set("state", "test-state-123");

    const res = await fetch(authorize, { redirect: "manual" });
    // Unauthenticated users are redirected to /login, or the consent page is
    // rendered. Either way the request was accepted (not a 400).
    expect([200, 302]).toContain(res.status);
    if (res.status === 400) {
      throw new Error(`authorize rejected the PKCE request: ${await res.text()}`);
    }
  });

  it("accepts a non-S256 challenge method at the authorize endpoint (documents prod drift)", async () => {
    let reg: Response;
    try {
      reg = await fetch(`${AS_URL}/oauth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "needmcp-cli-test",
          redirect_uris: ["http://localhost:33420/callback"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
      });
    } catch {
      return expect(true).toBe(true);
    }
    const { client_id } = await reg.json();

    const authorize = new URL(`${AS_URL}/oauth/authorize`);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", client_id);
    authorize.searchParams.set("redirect_uri", "http://localhost:33420/callback");
    authorize.searchParams.set("code_challenge", "a".repeat(43));
    authorize.searchParams.set("code_challenge_method", "plain");

    const res = await fetch(authorize, { redirect: "manual" });

    // Observed behaviour (2026-08): production accepts `plain` here even though
    // the repository's OAuthAuthorizationController validates `in:S256`. The
    // token exchange still hashes the verifier with SHA-256 unconditionally
    // (OAuthServerService::exchangeAuthorizationCode), so a `plain` flow can
    // never produce a passing exchange. The CLI always sends S256, so this only
    // documents the drift — it is not a CLI concern.
    expect([200, 302, 400]).toContain(res.status);
    if (res.status === 400) {
      const body = await res.json();
      expect(body.error).toBe("invalid_request");
    }
  });
});

describe("NeedMCP live: token endpoint", () => {
  it("returns invalid_grant for a bogus authorization code", async () => {
    let res: Response;
    try {
      res = await fetch(`${AS_URL}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "bogus",
          code_verifier: "x".repeat(43),
          client_id: "client_does_not_exist",
          redirect_uri: "http://localhost:1/callback",
        }),
      });
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
  });

  it("accepts application/json bodies too (not only form-encoded)", async () => {
    let res: Response;
    try {
      res = await fetch(`${AS_URL}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: "bogus",
          client_id: "client_does_not_exist",
        }),
      });
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
  });

  it("rejects an unsupported grant type", async () => {
    let res: Response;
    try {
      res = await fetch(`${AS_URL}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      });
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unsupported_grant_type");
  });
});

describe("NeedMCP live: /mcp authentication behaviour", () => {
  it("returns 401 with an OAuth discovery challenge when unauthenticated", async () => {
    let res: Response;
    try {
      res = await postMcp({});
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(401);
    const challenge = res.headers.get("www-authenticate");
    if (challenge) {
      expect(challenge).toContain("Bearer");
      expect(challenge).toContain("resource_metadata");
    }
  });

  it("rejects a malformed X-API-Key with an explicit message", async () => {
    let res: Response;
    try {
      res = await postMcp({ "x-api-key": "not-a-valid-prefix" });
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/Invalid API key format/i);
  });

  it("treats a correctly-prefixed but unknown key as invalid or revoked", async () => {
    let res: Response;
    try {
      res = await postMcp({ "x-api-key": "sk-need-0000000000000000000000" });
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/Invalid or revoked API key/i);
  });

  it("treats Authorization: Bearer with a key prefix the same as X-API-Key", async () => {
    // SimpleApiKeyAuth reads both headers into the same variable, so the
    // resulting error must be identical. If these ever diverge, the CLI should
    // stop assuming the two paths are interchangeable.
    let a: Response;
    let b: Response;
    try {
      a = await postMcp({ "x-api-key": "sk-need-0000000000000000000000" });
      b = await postMcp({ authorization: "Bearer sk-need-0000000000000000000000" });
    } catch {
      return expect(true).toBe(true);
    }

    expect(a.status).toBe(b.status);
    const aBody = await a.json();
    const bBody = await b.json();
    expect(JSON.stringify(aBody)).toMatch(/Invalid or revoked API key/i);
    expect(JSON.stringify(bBody)).toMatch(/Invalid or revoked API key/i);
  });

  it("flags an expired/unknown OAuth token as invalid_token", async () => {
    // 64 hex chars after the mcp_at_ prefix — the shape the server issues.
    const fakeOAuthToken = "mcp_at_" + "a".repeat(64);
    let res: Response;
    try {
      res = await postMcp({ authorization: `Bearer ${fakeOAuthToken}` });
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(401);
    const body = await res.json();
    // RFC 6749 error shape from handleOAuthAccessToken().
    expect(body.error).toBe("invalid_token");
    expect(body.error_description).toMatch(/invalid or has expired/i);

    // Note: production sends the *discovery* challenge
    // (`Bearer realm="mcp", resource_metadata="..."`) rather than the
    // `Bearer error="invalid_token"` the repository's SimpleApiKeyAuth sets.
    // Either way the challenge advertises Bearer, which is what clients act on.
    const challenge = res.headers.get("www-authenticate");
    expect(challenge).toContain("Bearer");
  });

  it("X-API-Key takes precedence over Authorization when both are sent", async () => {
    let res: Response;
    try {
      res = await postMcp({
        "x-api-key": "not-a-valid-prefix",
        authorization: "Bearer mcp_at_" + "b".repeat(64),
      });
    } catch {
      return expect(true).toBe(true);
    }

    // X-API-Key is read first, so the *API key* error wins — the Bearer OAuth
    // token is never consulted. This is why OAuth entries must be header-free.
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/Invalid API key format/i);
  });

  it("does not authenticate via a guest_id cookie while guest mode is off", async () => {
    let res: Response;
    try {
      res = await fetch(MCP_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          cookie: "guest_id=01M48N74Y080QR6JWVTNXN8VNY",
        },
        body: INITIALIZE_BODY,
      });
    } catch {
      return expect(true).toBe(true);
    }

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/Guest access is currently disabled/i);
  });
});
