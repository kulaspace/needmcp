import { describe, it, expect } from "vitest";
import { handleCallback } from "../oauth.js";

describe("handleCallback", () => {
  it("returns the api key on a valid callback", () => {
    const params = new URLSearchParams({ api_key: "sk-need-abcdefghij", state: "abc123" });
    expect(handleCallback(params, "abc123").apiKey).toBe("sk-need-abcdefghij");
  });

  it("accepts the `token` alias", () => {
    const params = new URLSearchParams({ token: "sk-need-abcdefghij", state: "abc123" });
    expect(handleCallback(params, "abc123").apiKey).toBe("sk-need-abcdefghij");
  });

  it("prefers `api_key` over `token`", () => {
    const params = new URLSearchParams({
      api_key: "sk-need-aaaaaaaaaa",
      token: "sk-need-bbbbbbbbbb",
      state: "abc123",
    });
    expect(handleCallback(params, "abc123").apiKey).toBe("sk-need-aaaaaaaaaa");
  });

  it("throws on state mismatch", () => {
    const params = new URLSearchParams({ api_key: "sk-need-abcdefghij", state: "wrong" });
    expect(() => handleCallback(params, "abc123")).toThrow(/state mismatch/i);
  });

  it("throws when no key is present", () => {
    const params = new URLSearchParams({ state: "abc123" });
    expect(() => handleCallback(params, "abc123")).toThrow(/no api key/i);
  });

  it("throws the server-provided error", () => {
    const params = new URLSearchParams({ error: "access_denied", state: "abc123" });
    expect(() => handleCallback(params, "abc123")).toThrow("access_denied");
  });
});
