import { detectOpencodeLayouts, needsLayoutChoice } from "../src/clients/opencode-layout.js";

/**
 * Prints what the real detection logic sees on the current PATH.
 *
 * Kept in its own file so the verifier can run it as a child process: detection
 * caches its answer, and a child sees exactly the PATH it is handed. Output is
 * one JSON line, which keeps parsing trivial.
 */
const detected = detectOpencodeLayouts();
console.log(JSON.stringify({ detected, both: needsLayoutChoice(detected) }));
