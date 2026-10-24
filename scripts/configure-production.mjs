import { readFileSync, writeFileSync } from "node:fs";
const { D1_DATABASE_ID, PUBLISHER_CONTACT } = process.env;
if (
  !D1_DATABASE_ID ||
  !/[a-f0-9-]{36}/i.test(D1_DATABASE_ID) ||
  D1_DATABASE_ID === "00000000-0000-0000-0000-000000000000"
)
  throw Error(
    "Set D1_DATABASE_ID to the database created with --jurisdiction eu.",
  );
if (!PUBLISHER_CONTACT)
  throw Error("Set PUBLISHER_CONTACT before enabling account creation.");
const path = new URL("../apps/api/wrangler.jsonc", import.meta.url);
const config = JSON.parse(readFileSync(path));
config.d1_databases[0].database_id = D1_DATABASE_ID;
config.vars.PUBLISHER_CONTACT = PUBLISHER_CONTACT;
writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
