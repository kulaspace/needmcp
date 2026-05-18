#!/usr/bin/env node

import "dotenv/config";
import { Command } from "commander";
import pc from "picocolors";
import { runSetup, runUninstall } from "./setup.js";
import { runStyle } from "./style.js";
import { CliError } from "./errors.js";

const program = new Command();

program
  .name("needmcp")
  .description("NeedMCP CLI — Setup MCP configuration for AI coding assistants")
  .version("1.0.0")
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
`
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

program
  .command("style")
  .description("Activate or deactivate a NeedMCP style")
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

program.parse(process.argv);
