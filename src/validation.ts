export function validateApiKey(key: string): string | undefined {
  if (!key) return "API key is required";
  if (!/^(?:sk[-_]need[-_])[A-Za-z0-9]{10,}$/.test(key)) {
    return "API key must be in format sk_need_xxx or sk-need-xxx";
  }
}
