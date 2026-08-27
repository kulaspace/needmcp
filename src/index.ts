#!/usr/bin/env node

declare const __VERSION__: string;

import "dotenv/config";
import { Command } from "commander";
import pc from "picocolors";
import { runSetup, runUninstall } from "./setup.js";
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
  .action(async (options) => {
    try {
      await runSetup(options.key);
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      if (err instanceof CliError) {
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
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      if (err instanceof CliError) {
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
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      if (err instanceof CliError) {
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
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      if (err instanceof CliError) {
        process.exit(1);
      }
      console.error(pc.red("Unexpected error:"), err);
      process.exit(1);
    }
  });

program.parse(process.argv);
