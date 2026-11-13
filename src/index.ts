#!/usr/bin/env node

declare const __VERSION__: string;

import { loadEnv } from "./env.js";

// Must run before any module reads `process.env` at import time (constants.ts).
loadEnv();

import { Command } from "commander";
import pc from "picocolors";
import { runSetup, runUninstall } from "./setup.js";
import type { AuthMode } from "./setup.js";
import { runStyle } from "./style.js";
import { runDesign } from "./design.js";
import { CliError } from "./errors.js";

const program = new Command();

program
  .name("needmcp")
  .description("NeedMCP CLI — Setup MCP configuration for AI coding assistants")
  .version(__VERSION__)
  .addHelpText(
    "after",
    `
Examples:
  ${pc.dim("# Setup with interactive prompts")}
  ${pc.cyan("needmcp setup")}

  ${pc.dim("# Setup with API key")}
  ${pc.cyan("needmcp setup --key sk-need-xxxx")}

  ${pc.dim("# Setup with OAuth 2.1 (default choice)")}
  ${pc.cyan("needmcp setup --auth oauth")}

  ${pc.dim("# Non-interactive, for AI agents")}
  ${pc.cyan("needmcp setup --client opencode --scope global --auth oauth --yes --json")}

  ${pc.dim("# Remove NeedMCP from clients")}
  ${pc.cyan("needmcp remove")}

  ${pc.dim("# Download design system")}
  ${pc.cyan("needmcp design modern-dashboard")}
`,
  );

program
  .command("setup")
  .description("Setup NeedMCP MCP server for your AI clients")
  .option("-k, --key <key>", "NeedMCP API key")
  .option("-a, --auth <method>", "Auth: oauth (OAuth 2.1, or browser-created key) | key")
  .option("-c, --client <id>", "Client id to configure, skips the picker")
  .option("-s, --scope <scope>", "Config scope: global | project")
  .option("-y, --yes", "Accept recommended defaults instead of prompting")
  .option("--json", "Print a JSON result line as the last stdout line")
  .action(async (options) => {
    try {
      let authMode: AuthMode | undefined;
      if (options.auth !== undefined) {
        const value = String(options.auth).toLowerCase();
        if (value !== "oauth" && value !== "key") {
          console.error(pc.red(`Invalid --auth value "${options.auth}". Use "oauth" or "key".`));
          process.exit(1);
        }
        authMode = value;
      }

      let scope: "global" | "project" | undefined;
      if (options.scope !== undefined) {
        const value = String(options.scope).toLowerCase();
        if (value !== "global" && value !== "project") {
          console.error(pc.red(`Invalid --scope value "${options.scope}". Use "global" or "project".`));
          process.exit(1);
        }
        scope = value;
      }

      await runSetup(options.key, authMode, {
        client: options.client,
        scope,
        yes: options.yes,
        json: options.json,
      });

      // In --json mode the result must reach the caller intact: process.exit()
      // can truncate a piped stdout before it drains.
      if (!options.json) process.exit(0);
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      if (err instanceof CliError) {
        console.error(pc.red(err.message));
        process.exit(1);
      }
      console.error(pc.red("Unexpected error:"), err);
      process.exit(1);
    }
  });

program
  .command("remove")
  .description("Remove NeedMCP MCP server from your AI clients")
  .action(async () => {
    try {
      await runUninstall();
      process.exit(0);
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      if (err instanceof CliError) {
        console.error(pc.red(err.message));
        process.exit(1);
      }
      console.error(pc.red("Unexpected error:"), err);
      process.exit(1);
    }
  });

const style = program
  .command("style")
  .description("Activate or deactivate a NeedMCP style");

style
  .command("set")
  .description("Activate a style by slug")
  .argument("<slug>", "Style slug (e.g., modern-dashboard)")
  .action(async (slug) => {
    try {
      await runStyle(slug);
      process.exit(0);
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      if (err instanceof CliError) {
        console.error(pc.red(err.message));
        process.exit(1);
      }
      console.error(pc.red("Unexpected error:"), err);
      process.exit(1);
    }
  });

program
  .command("design")
  .description("Download a style design system as DESIGN.md")
  .argument("<slug>", "Style slug (e.g., modern-dashboard)")
  .option("-f, --force", "Overwrite DESIGN.md without asking")
  .action(async (slug, options) => {
    try {
      await runDesign(slug, { force: options.force });
      process.exit(0);
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      if (err instanceof CliError) {
        console.error(pc.red(err.message));
        process.exit(1);
      }
      console.error(pc.red("Unexpected error:"), err);
      process.exit(1);
    }
  });

program.parse(process.argv);
