#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { runSetup } from "./setup.js";

const program = new Command();

program
  .name("needmcp")
  .description("NeedMCP CLI — Setup MCP configuration for AI coding assistants")
  .version("0.1.0")
  .addHelpText(
    "after",
    `
Examples:
  ${pc.dim("# Setup with interactive prompts")}
  ${pc.cyan("needmcp setup")}

  ${pc.dim("# Setup with API key")}
  ${pc.cyan("needmcp setup --key sk-xxxx")}

  ${pc.dim("# Setup for current project (vs global)")}
  ${pc.cyan("needmcp setup --scope project")}
`
  );

program
  .command("setup")
  .description("Setup NeedMCP MCP server for your AI clients")
  .option("-k, --key <key>", "NeedMCP API key")
  .option("-s, --scope <scope>", "Config scope: global or project", "global")
  .action(async (options) => {
    try {
      await runSetup(options.key, options.scope);
    } catch (err) {
      if (err instanceof Error && err.name === "ExitPromptError") {
        process.exit(0);
      }
      console.error(pc.red("Unexpected error:"), err);
      process.exit(1);
    }
  });

program.parse(process.argv);
