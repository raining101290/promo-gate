// Self-host the QR decoder wasm used by @yudiel/react-qr-scanner's fallback (browsers without a native
// BarcodeDetector, e.g. iOS Safari). Without this the library downloads it from fastly.jsdelivr.net at
// runtime. Runs on postinstall so the copy always matches the installed zxing-wasm version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
// Resolve from barcode-detector so we get the exact zxing-wasm version the scanner uses.
const src = require.resolve("zxing-wasm/reader/zxing_reader.wasm", { paths: [require.resolve("barcode-detector")] });
const destDir = join(process.cwd(), "public/vendor/zxing");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "zxing_reader.wasm"));
console.log(`[zxing] copied ${src} -> public/vendor/zxing/zxing_reader.wasm`);
