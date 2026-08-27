import { intro, outro, cancel, isCancel, confirm } from "@clack/prompts";
import pc from "picocolors";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, resolveBaseUrl } from "./config.js";
import { atomicWrite } from "./mcp-writer.js";
import { CliError } from "./errors.js";

export interface RunDesignOptions {
  force?: boolean;
}

export async function runDesign(slug: string, options: RunDesignOptions = {}): Promise<void> {
  intro(pc.bgMagenta(pc.black(" needmcp design ")));

  const config = await loadConfig();

  const url = `${resolveBaseUrl(config)}/api/styles/${encodeURIComponent(slug)}/designmd`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.apiKey) {
    headers["X-API-Key"] = config.apiKey;
  }

  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers });
  } catch (err) {
    console.error(pc.red(`✖ Network error: ${err instanceof Error ? err.message : String(err)}`));
    throw new CliError("Network request failed");
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response
  }

  if (response.status === 200) {
    const designMd = body?.design_md;
    if (typeof designMd !== "string" || designMd.length === 0) {
      console.error(pc.red("✖ Invalid response: missing design_md field"));
      throw new CliError("Invalid API response");
    }

    const targetPath = resolve(process.cwd(), "DESIGN.md");

    // Confirm before overwrite unless --force
    if (!options.force) {
      let exists = false;
      try {
        await access(targetPath);
        exists = true;
      } catch {
        exists = false;
      }

      if (exists) {
        const shouldOverwrite = await confirm({
          message: `DESIGN.md already exists at ${pc.cyan(targetPath)}. Overwrite?`,
        });
        if (isCancel(shouldOverwrite)) {
          cancel("Cancelled");
          return;
        }
        if (!shouldOverwrite) {
          cancel("Cancelled — file not overwritten");
          return;
        }
      }
    }

    await atomicWrite(targetPath, designMd);
    console.log(`  ${pc.green("✔")} Saved design system to ${pc.cyan(targetPath)}`);
    outro(pc.green("Done"));
    return;
  }

  if (response.status === 401) {
    const msg =
      (body?.error as string) ||
      (body?.message as string) ||
      "Invalid API key. Run `needmcp setup` to configure your key.";
    console.error(`  ${pc.red("✖")} ${msg}`);
    throw new CliError("Authentication failed");
  }

  if (response.status === 403) {
    const msg =
      (body?.message as string) ||
      "This design system is premium. Please subscribe to access it.";
    console.error(`  ${pc.red("✖")} ${msg}`);
    throw new CliError("Access forbidden");
  }

  if (response.status === 404) {
    const msg = (body?.message as string) || "Style not found.";
    console.error(`  ${pc.red("✖")} ${msg}`);
    throw new CliError("Style not found");
  }

  if (response.status === 429) {
    const msg =
      (body?.message as string) || "Quota exceeded. Please check your plan limits.";
    console.error(`  ${pc.red("✖")} ${msg}`);
    throw new CliError("Quota exceeded");
  }

  // Generic error — prefer server message if available
  const serverMsg =
    (body?.message as string) || (body?.error as string) || `Unexpected error (${response.status})`;
  console.error(`  ${pc.red("✖")} ${serverMsg}`);
  throw new CliError(`API error: ${response.status}`);
}
