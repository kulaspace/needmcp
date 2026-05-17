import { describe, it, expect } from "vitest";
import { validateApiKey } from "../validation.js";

describe("validateApiKey", () => {
  it("accepts sk_need_ format", () => {
    expect(validateApiKey("sk_need_Sgy1p3r25UD4qQErwF2g")).toBeUndefined();
  });

  it("accepts sk-need- format", () => {
    expect(validateApiKey("sk-need-Sgy1p3r25UD4qQErwF2g")).toBeUndefined();
  });

  it("rejects empty key", () => {
    expect(validateApiKey("")).toBe("API key is required");
  });

  it("rejects key without prefix", () => {
    expect(validateApiKey("abc123")).toMatch(/format/);
  });

  it("rejects too short key", () => {
    expect(validateApiKey("sk-need-ab")).toMatch(/format/);
  });

  it("rejects key with wrong separator", () => {
    expect(validateApiKey("sk.need.abc123xyz")).toMatch(/format/);
  });
});
