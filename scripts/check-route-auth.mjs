// Fails if any route handler or server action lacks an auth check (or an explicit, reviewed exemption).
// Run: npm run check:auth
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const AUTH_CALLS = [
  "withStaff(", // staff session + role (DB-checked)
  "requireStaff(",
  "getCustomerSession(", // customer session (DB-checked, not deleted)
  "verifyLocalToken(", // HMAC-signed, expiring storage URL
  "authorised(req)", // cron bearer secret
];

/** Public on purpose. Each entry says why it may run without a session. */
const PUBLIC = {
  "src/app/api/auth/otp/request/route.ts": "login step 1 (rate limited per IP + target)",
  "src/app/api/auth/otp/verify/route.ts": "login step 2 (rate limited, hashed single-use codes)",
  "src/app/api/admin/login/route.ts": "staff login (rate limited, bcrypt)",
  "src/app/api/auth/logout/route.ts": "only clears the caller's own cookie",
  "src/app/api/admin/logout/route.ts": "only clears the caller's own cookie",
  "src/app/api/health/route.ts": "uptime check: returns only ok/error + latency, no data",
  "src/app/api/offer-requests/route.ts": "public invoice form (rate limited per IP; session only used to skip the OTP)",
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk("src/app").filter((f) => (f.startsWith("src/app/api/") && /\/route\.ts$/.test(f)) || /\/actions[^/]*\.tsx?$/.test(f) || /\/actions\//.test(f));
let failures = 0;
for (const f of files.sort()) {
  const src = readFileSync(f, "utf8");
  const found = AUTH_CALLS.filter((c) => src.includes(c));
  if (PUBLIC[f]) console.log(`PUBLIC  ${f}  ->  ${PUBLIC[f]}`);
  else if (found.length) console.log(`AUTH    ${f}  ->  ${found.join(", ")}`);
  else {
    console.log(`MISSING ${f}`);
    failures++;
  }
}
const actions = files.filter((f) => /actions/.test(f)).length;
console.log(`\n${files.length} files checked (${actions} server-action files). ${failures ? `${failures} WITHOUT auth` : "All have an auth check or a documented exemption."}`);
process.exit(failures ? 1 : 0);
