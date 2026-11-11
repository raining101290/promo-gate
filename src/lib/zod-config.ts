import { z } from "zod";

// Zod 4 probes `new Function("")` to decide whether to JIT-compile validators. Our CSP forbids eval
// (no 'unsafe-eval' in production), so the probe would log a CSP violation on every page. Jitless
// mode skips the probe; validation behaves the same. Imported first by every shared schema module.
z.config({ jitless: true });
