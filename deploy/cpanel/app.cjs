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

// Client IP. The web server (LiteSpeed on this host) reaches this process over a local socket (remoteAddress
// is 127.0.0.1) and APPENDS the visitor's address to X-Forwarded-For, after anything the client sent itself.
// The app's rate limits read the FIRST entry, which a client can forge, so keep only the LAST one (the hop the
// server added) before Next.js reads the headers. (If a CDN/proxy such as Cloudflare is ever put in front, revisit: the last hop is the proxy.)
const http = require("node:http");
const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, req, ...rest) {
  if (event === "request" && req && req.headers) {
    const hops = String(req.headers["x-forwarded-for"] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const socketIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress.replace(/^::ffff:/, "") : "";
    const ip = hops.length ? hops[hops.length - 1] : socketIp;
    delete req.headers["x-real-ip"];
    if (ip) req.headers["x-forwarded-for"] = ip;
    else delete req.headers["x-forwarded-for"];
  }
  return emit.call(this, event, req, ...rest);
};

import(pathToFileURL(path.join(release, "server.js")).href).catch((err) => {
  console.error(`[perks] failed to start ${release}: ${err && err.message}`);
  process.exit(1);
});
