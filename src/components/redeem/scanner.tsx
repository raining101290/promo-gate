"use client";

import { Scanner, setZXingModuleOverrides, type IDetectedBarcode, type IScannerError } from "@yudiel/react-qr-scanner";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { parseBranchQr } from "@/lib/redemption";

// Fallback decoder wasm is self-hosted (copied on postinstall) instead of loaded from a public CDN.
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/vendor/zxing/${path}` : prefix + path),
});

// The library's defaults demand min 640px width AND height, which 640x480 cameras (older/low-end
// phones, many webcams) can't satisfy ("overconstrained"). Prefer HD, accept anything.
const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: "environment",
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

/**
 * In-app camera scanner for the branch standee QR. On a valid /r/<code> URL it navigates (within this
 * app only) to the branch page with the voucher preselected. Load with next/dynamic (ssr: false).
 */
export function BranchQrScanner({ voucherId }: { voucherId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const handled = useRef(false);

  function onScan(codes: IDetectedBarcode[]) {
    if (handled.current) return;
    for (const c of codes) {
      const branchCode = parseBranchQr(c.rawValue);
      if (branchCode) {
        handled.current = true;
        setMessage("Found it! Opening…");
        router.push(`/r/${branchCode}?v=${encodeURIComponent(voucherId)}`);
        return;
      }
    }
    setMessage("That isn't a Hosting.com Perks counter QR. Look for the standee at the till.");
  }

  function onError(err: IScannerError) {
    console.warn(`[scanner] ${err.kind}: ${err.message}`);
    setMessage(
      err.kind === "permission-denied"
        ? "Camera access was blocked. Allow the camera for this site, or scan the standee with your phone's camera app."
        : err.kind === "insecure-context"
          ? "The camera needs a secure (https) connection. Scan the standee with your phone's camera app instead."
          : "Couldn't start the camera. Scan the standee with your phone's camera app instead.",
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-xl bg-black" data-testid="scanner">
        <Scanner
          onScan={onScan}
          onError={onError}
          formats={["qr_code"]}
          constraints={CAMERA_CONSTRAINTS}
          allowMultiple={false}
          sound={false}
          paused={handled.current}
        />
      </div>
      <p className="text-muted-foreground min-h-10 text-center text-sm" role="status" data-testid="scanner-status">
        {message ?? "Point your camera at the QR on the café counter."}
      </p>
    </div>
  );
}
