import { loadEnv } from "../src/env.js";
import { resolveMcpUrl, resolveBaseUrl } from "../src/config.js";

loadEnv();

console.log("cwd:", process.cwd());
console.log("NEEDMCP_BASE_URL env :", process.env.NEEDMCP_BASE_URL ?? "(unset)");
console.log("resolveBaseUrl       :", resolveBaseUrl({}));
console.log("resolveMcpUrl        :", resolveMcpUrl({}));
