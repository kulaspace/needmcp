import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import http from "node:http";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";

// Never launch a real browser during the test.
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

const { loginWithOAuth } = await import("../oauth.js");

/** Minimal stand-in for the NeedMCP backend implementing the v1.6.0 contract. */
let backend: http.Server;
let baseUrl: string;
let expectedChallenge = "";
let tokenRequests: Array<Record<string, unknown>> = [];
const AUTH_CODE = "c".repeat(48);

beforeAll(async () => {
  backend = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (req.method === "GET" && url.pathname === "/oauth/cli") {
      expectedChallenge = url.searchParams.get("code_challenge") || "";
      res.writeHead(200).end("consent page");
      return;
    }

    if (req.method === "POST" && url.pathname === "/oauth/cli/token") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = JSON.parse(raw) as Record<string, string>;
        tokenRequests.push(body);

        const computed = crypto
          .createHash("sha256")
          .update(body.code_verifier)
          .digest("base64url");

        if (computed !== expectedChallenge) {
          res.writeHead(422, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "invalid_grant: PKCE mismatch" }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            api_key: "sk-need-e2etestkey1234567890",
            name: "NeedMCP CLI",
            masked_key: "sk-need-***7890",
          })
        );
      });
      return;
    }

    res.writeHead(404).end("Not Found");
  });

  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const { port } = backend.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => backend.close(() => resolve()));
});

describe("loginWithOAuth end-to-end", () => {
  it("completes the PKCE flow against a spec-compliant backend", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => {
      logs.push(a.join(" "));
    });

    const pending = loginWithOAuth(baseUrl);

    // Wait for the CLI to print the authorization URL.
    let authUrl = "";
    for (let i = 0; i < 100 && !authUrl; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const match = logs.join("\n").match(/https?:\/\/\S+\/oauth\/cli\?\S+/);
      if (match) authUrl = match[0].replace(/\[\d+m/g, "");
    }

    expect(authUrl).toBeTruthy();

    const params = new URL(authUrl).searchParams;
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(params.get("state")).toMatch(/^[0-9a-f]{32}$/);
    expect(params.get("callback")).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(params.get("client")).toBe("NeedMCP CLI");

    // Simulate the browser: record the challenge server-side, then redirect.
    expectedChallenge = params.get("code_challenge")!;
    const callbackUrl = new URL(params.get("callback")!);
    callbackUrl.searchParams.set("code", AUTH_CODE);
    callbackUrl.searchParams.set("state", params.get("state")!);

    const page = await fetch(callbackUrl);
    const html = await page.text();

    expect(page.status).toBe(200);
    expect(html).toContain("Authentication Successful");
    // The success page must never contain the API key.
    expect(html).not.toContain("sk-need-e2etestkey1234567890");

    await expect(pending).resolves.toBe("sk-need-e2etestkey1234567890");

    expect(tokenRequests).toHaveLength(1);
    expect(tokenRequests[0]).toEqual({
      code: AUTH_CODE,
      code_verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      callback_url: callbackUrl.origin + "/callback",
    });

    vi.restoreAllMocks();
  });

  it("renders the error page when the token exchange is rejected", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => {
      logs.push(a.join(" "));
    });

    const pending = loginWithOAuth(baseUrl);
    pending.catch(() => {});

    let authUrl = "";
    for (let i = 0; i < 100 && !authUrl; i++) {
      await new Promise((r) => setTimeout(r, 20));
      const match = logs.join("\n").match(/https?:\/\/\S+\/oauth\/cli\?\S+/);
      if (match) authUrl = match[0].replace(/\[\d+m/g, "");
    }

    const params = new URL(authUrl).searchParams;
    // Force a PKCE mismatch by changing the stored challenge.
    expectedChallenge = crypto.createHash("sha256").update("wrong").digest("base64url");

    const callbackUrl = new URL(params.get("callback")!);
    callbackUrl.searchParams.set("code", AUTH_CODE);
    callbackUrl.searchParams.set("state", params.get("state")!);

    const page = await fetch(callbackUrl);
    const html = await page.text();

    expect(page.status).toBe(400);
    expect(html).toContain("Authentication Failed");
    expect(html).toContain("invalid_grant");
    // Error text is HTML-escaped.
    expect(html).not.toContain("<script>");

    await expect(pending).rejects.toThrow(/invalid_grant/);

    vi.restoreAllMocks();
  });
});
