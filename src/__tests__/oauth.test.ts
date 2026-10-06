import { describe, it, expect, afterEach, vi } from "vitest";
import { spawnSync } from "node:child_process";
import {
  handleCallback,
  escapeHtml,
  generatePkce,
  exchangeCodeForApiKey,
  buildWindowsOpenArgs,
} from "../oauth.js";

describe("generatePkce", () => {
  it("generates a valid verifier and S256 challenge", () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("derives the challenge from the verifier", async () => {
    const crypto = await import("node:crypto");
    const { verifier, challenge } = generatePkce();
    const expected = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expected);
  });

  it("produces a new verifier on every call", () => {
    expect(generatePkce().verifier).not.toBe(generatePkce().verifier);
  });
});

describe("handleCallback", () => {
  it("returns the authorization code on a valid callback", () => {
    const params = new URLSearchParams({ code: "AUTH_CODE_12345", state: "abc123" });
    expect(handleCallback(params, "abc123")).toEqual({ code: "AUTH_CODE_12345" });
  });

  it("throws on state mismatch", () => {
    const params = new URLSearchParams({ code: "AUTH_CODE_12345", state: "wrong" });
    expect(() => handleCallback(params, "abc123")).toThrow(/state mismatch/i);
  });

  it("throws when no code is present", () => {
    const params = new URLSearchParams({ state: "abc123" });
    expect(() => handleCallback(params, "abc123")).toThrow(/no authorization code/i);
  });

  it("throws the server-provided error", () => {
    const params = new URLSearchParams({ error: "access_denied", state: "abc123" });
    expect(() => handleCallback(params, "abc123")).toThrow("access_denied");
  });

  it("validates state before reporting a server error", () => {
    const params = new URLSearchParams({ error: "access_denied", state: "wrong" });
    expect(() => handleCallback(params, "abc123")).toThrow(/state mismatch/i);
  });

  it("falls back to the legacy `api_key` callback parameter", () => {
    const params = new URLSearchParams({ api_key: "sk-need-abcdefghij", state: "abc123" });
    expect(handleCallback(params, "abc123")).toEqual({ apiKey: "sk-need-abcdefghij" });
  });

  it("accepts the legacy `token` alias", () => {
    const params = new URLSearchParams({ token: "sk-need-abcdefghij", state: "abc123" });
    expect(handleCallback(params, "abc123")).toEqual({ apiKey: "sk-need-abcdefghij" });
  });

  it("prefers the authorization code over legacy keys", () => {
    const params = new URLSearchParams({
      code: "AUTH_CODE_12345",
      api_key: "sk-need-aaaaaaaaaa",
      token: "sk-need-bbbbbbbbbb",
      state: "abc123",
    });
    expect(handleCallback(params, "abc123")).toEqual({ code: "AUTH_CODE_12345" });
  });

  it("prefers legacy `api_key` over `token`", () => {
    const params = new URLSearchParams({
      api_key: "sk-need-aaaaaaaaaa",
      token: "sk-need-bbbbbbbbbb",
      state: "abc123",
    });
    expect(handleCallback(params, "abc123")).toEqual({ apiKey: "sk-need-aaaaaaaaaa" });
  });
});

describe("exchangeCodeForApiKey", () => {
  const callbackUrl = "http://127.0.0.1:54321/callback";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("returns the api key from a successful exchange", async () => {
    const fetchMock = stubFetch(
      Response.json({
        api_key: "sk-need-abcdefghijklmnop",
        name: "NeedMCP CLI",
        masked_key: "sk-need-***mnop",
      })
    );

    const apiKey = await exchangeCodeForApiKey(
      "https://needmcp.com",
      "AUTH_CODE_12345",
      "verifier-123",
      callbackUrl
    );

    expect(apiKey).toBe("sk-need-abcdefghijklmnop");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://needmcp.com/oauth/cli/token");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(
      "needmcp-cli/1.6.0"
    );
    expect(JSON.parse(init.body as string)).toEqual({
      code: "AUTH_CODE_12345",
      code_verifier: "verifier-123",
      callback_url: callbackUrl,
    });
  });

  it("strips trailing slashes from the base url", async () => {
    const fetchMock = stubFetch(Response.json({ api_key: "sk-need-x", name: "", masked_key: "" }));

    await exchangeCodeForApiKey("https://needmcp.com///", "CODE", "verifier", callbackUrl);

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "https://needmcp.com/oauth/cli/token"
    );
  });

  it("surfaces the server message on a 422 invalid_grant", async () => {
    stubFetch(
      Response.json({ message: "Authorization code expired or already used." }, { status: 422 })
    );

    await expect(
      exchangeCodeForApiKey("https://needmcp.com", "CODE", "verifier", callbackUrl)
    ).rejects.toThrow("Authorization code expired or already used.");
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    stubFetch(new Response("<html>Gateway Error</html>", { status: 502 }));

    await expect(
      exchangeCodeForApiKey("https://needmcp.com", "CODE", "verifier", callbackUrl)
    ).rejects.toThrow(/token exchange failed with status 502/i);
  });

  it("returns a friendly error on 429", async () => {
    stubFetch(Response.json({ message: "Too Many Attempts." }, { status: 429 }));

    await expect(
      exchangeCodeForApiKey("https://needmcp.com", "CODE", "verifier", callbackUrl)
    ).rejects.toThrow(/too many authentication attempts/i);
  });

  it("throws when the response contains no api key", async () => {
    stubFetch(Response.json({ name: "NeedMCP CLI", masked_key: "sk-need-***xxxx" }));

    await expect(
      exchangeCodeForApiKey("https://needmcp.com", "CODE", "verifier", callbackUrl)
    ).rejects.toThrow(/did not contain an api key/i);
  });
});

describe("buildWindowsOpenArgs", () => {
  const authUrl =
    "http://127.0.0.1:8000/oauth/cli?callback=http%3A%2F%2F127.0.0.1%3A52958%2Fcallback" +
    "&state=abc123def456&client=NeedMCP+CLI" +
    "&code_challenge=XYZXYZXY&code_challenge_method=S256";

  it("keeps the start window title slot empty", () => {
    const [, , title] = buildWindowsOpenArgs("https://needmcp.com");
    expect(title).toBe("");
  });

  it("caret-escapes every ampersand in the url", () => {
    const args = buildWindowsOpenArgs(authUrl);
    const target = args[3];

    expect(target).not.toMatch(/(^|[^^])&/);
    expect(target.replace(/\^&/g, "&")).toBe(authUrl);
  });

  it("leaves a url without query parameters untouched", () => {
    expect(buildWindowsOpenArgs("https://needmcp.com/docs")[3]).toBe(
      "https://needmcp.com/docs"
    );
  });

  // The bug this guards against was invisible to the mocked end-to-end test:
  // execFile is intercepted there, so nothing exercised cmd.exe's own argument
  // parsing. Replaying the argv through a real cmd.exe closes that gap.
  //
  // `echo` stands in for `start` so the URL cmd.exe actually parsed is
  // observable on stdout. `spawnSync` is used over `execFileSync` because the
  // unescaped case deliberately exits non-zero.
  const parseViaCmd = (target: string) => {
    const result = spawnSync("cmd.exe", ["/c", "echo", target], { encoding: "utf8" });
    return (result.stdout ?? "").trim();
  };

  it.runIf(process.platform === "win32")(
    "survives a real cmd.exe parse with every oauth parameter intact",
    () => {
      const [, , , target] = buildWindowsOpenArgs(authUrl);

      const params = new URL(parseViaCmd(target)).searchParams;
      expect(params.get("callback")).toBe("http://127.0.0.1:52958/callback");
      expect(params.get("state")).toBe("abc123def456");
      expect(params.get("client")).toBe("NeedMCP CLI");
      expect(params.get("code_challenge")).toBe("XYZXYZXY");
      expect(params.get("code_challenge_method")).toBe("S256");
    }
  );

  it.runIf(process.platform === "win32")(
    "demonstrates that an unescaped url is truncated at the first ampersand",
    () => {
      // Guards against a regression to the naive `["/c", "start", "", url]`.
      const params = new URL(parseViaCmd("http://h/p?a=1&b=2&c=3")).searchParams;

      expect(params.get("a")).toBe("1");
      expect(params.get("b")).toBeNull();
      expect(params.get("c")).toBeNull();
    }
  );
});

describe("escapeHtml", () => {
  it("escapes all HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });

  it("escapes ampersands and single quotes", () => {
    expect(escapeHtml("a & b 'c'")).toBe("a &amp; b &#39;c&#39;");
  });

  it("escapes ampersand before other entities to avoid double-unescaping", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Authentication timed out. Please try again.")).toBe(
      "Authentication timed out. Please try again."
    );
  });
});
