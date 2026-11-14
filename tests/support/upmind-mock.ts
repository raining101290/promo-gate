import { appendFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";

/**
 * Stand-in for Upmind's redemption webhook in e2e/guide runs: answers 200 and appends each JSON body
 * to `file` (one line per call) so tests can assert what we sent.
 */
export function startUpmindMock(port: number, file: string): Promise<() => Promise<void>> {
  rmSync(file, { force: true });
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      appendFileSync(file, `${raw.replace(/\n/g, " ")}\n`);
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(() => new Promise((r) => server.close(() => r())))));
}
