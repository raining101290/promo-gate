// Startup file for cPanel "Setup Node.js App" (Phusion Passenger). activate.sh copies it to ~/perks/app/app.cjs.
//
// Layout on the server (PERKS_HOME defaults to the folder above this file, i.e. ~/perks):
//   app/app.cjs          this file (Passenger "Application root" = perks/app, "startup file" = app.cjs)
//   current -> releases/<id>   the active release (Next.js standalone build)
//   shared/.env          production settings (chmod 600), loaded below
//   shared/storage/      receipt photos (STORAGE_LOCAL_DIR)
//
// Passenger intercepts the server's listen() call, so the port/host values Next.js picks don't matter.
// A deploy switches `current` and touches app/tmp/restart.txt; the next request starts a fresh process here.
"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- Passenger loads this start file as CommonJS */

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const home = process.env.PERKS_HOME || path.resolve(__dirname, "..");
const envFile = path.join(home, "shared", ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile); // never overrides variables already set

const release = fs.realpathSync(path.join(home, "current"));
process.env.NODE_ENV = "production";
process.env.PERKS_RELEASE = path.basename(release); // shown by /api/health so a deploy can confirm the switch
process.env.NEXT_TELEMETRY_DISABLED = "1";

import(pathToFileURL(path.join(release, "server.js")).href).catch((err) => {
  console.error(`[perks] failed to start ${release}: ${err && err.message}`);
  process.exit(1);
});
