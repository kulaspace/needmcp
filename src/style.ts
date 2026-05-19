import { intro, outro } from "@clack/prompts";
import pc from "picocolors";
import { loadConfig, resolveBaseUrl } from "./config.js";
import { detectAllClients } from "./clients/index.js";
import { runSetup } from "./setup.js";
import { CliError } from "./errors.js";

export async function runStyle(slug: string): Promise<void> {
  const detected = await detectAllClients();
  const configured = detected.filter((d) => d.configured);

  if (configured.length === 0) {
    console.log(pc.cyan("→ NeedMCP MCP server not detected. Running setup first...\n"));
    await runSetup();
    console.log();
  }

  intro(pc.bgMagenta(pc.black(" needmcp style set ")));

  const config = await loadConfig();
  if (!config.apiKey) {
    console.error(pc.red("✖ API key not found after setup."));
    throw new CliError("API key not found");
  }

  const url = `${resolveBaseUrl(config)}/api/styles/${encodeURIComponent(slug)}/select`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "X-API-Key": config.apiKey },
    });
  } catch (err) {
    console.error(pc.red(`✖ Network error: ${err instanceof Error ? err.message : String(err)}`));
    throw new CliError("Network request failed");
  }

  const body = await response.json();

  if (response.status === 200) {
    console.log(`  ${pc.green("✔")} ${body.message}`);
  } else if (response.status === 401) {
    console.error(`  ${pc.red("✖")} ${body.error || "Invalid API key."}`);
    throw new CliError("Authentication failed");
  } else if (response.status === 403) {
    console.error(`  ${pc.red("✖")} ${body.message || "Premium style — please subscribe."}`);
    throw new CliError("Premium style required");
  } else if (response.status === 404) {
    console.error(`  ${pc.red("✖")} ${body.message || "Style not found."}`);
    throw new CliError("Style not found");
  } else {
    console.error(`  ${pc.red("✖")} Unexpected error (${response.status})`);
    throw new CliError(`API error: ${response.status}`);
  }

  outro(pc.green("Done"));
}
