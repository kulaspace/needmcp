#!/usr/bin/env node

import { intro, text, select, outro, cancel, isCancel } from "@clack/prompts";
import pc from "picocolors";

async function main() {
  intro(pc.bgCyan(pc.black(" needmcp CLI ")));

  const name = await text({
    message: "What is your name?",
    placeholder: "Type your name...",
    validate(value) {
      if (!value) return "Name is required";
    },
  });

  if (isCancel(name)) {
    cancel("Operation cancelled");
    process.exit(1);
  }

  const color = await select({
    message: `Hi ${pc.cyan(name as string)}, pick a color:`,
    options: [
      { value: "red", label: "Red" },
      { value: "green", label: "Green" },
      { value: "blue", label: "Blue" },
    ],
  });

  if (isCancel(color)) {
    cancel("Operation cancelled");
    process.exit(1);
  }

  const colorMap: Record<string, (s: string) => string> = {
    red: pc.red,
    green: pc.green,
    blue: pc.blue,
  };

  const style = colorMap[color as string] ?? pc.white;

  outro(style(`You picked ${color}! Have a great day, ${name}!`));
}

main().catch((err) => {
  console.error(pc.red("Unexpected error:"), err);
  process.exit(1);
});
