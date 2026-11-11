"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RECEIPT_MAX_BYTES, RECEIPT_MAX_EDGE_PX, RECEIPT_TYPES } from "@/lib/schemas/receipt";

type Prepared = { blob: Blob; type: string; width?: number; height?: number; compressed: boolean };

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.heic,.heif";
const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024; // decode guard; what we upload is capped at 8 MB

/** Some browsers report "" for HEIC; fall back to the extension. */
function typeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "heic" ? "image/heic" : ext === "heif" ? "image/heif" : "";
}

/** Downscale to ≤1600px on the long edge and re-encode as JPEG (respects EXIF rotation). HEIC that this
 *  browser can't decode (most non-Safari browsers) is uploaded as-is if it fits the size limit. */
async function prepare(file: File): Promise<Prepared> {
  const type = typeOf(file);
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, RECEIPT_MAX_EDGE_PX / Math.max(bmp.width, bmp.height));
    const width = Math.round(bmp.width * scale);
    const height = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob) throw new Error("encode failed");
    return { blob, type: "image/jpeg", width, height, compressed: true };
  } catch {
    if (type === "image/heic" || type === "image/heif") return { blob: file, type, compressed: false };
    throw new Error("We couldn't read that image. Try another photo.");
  }
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function ReceiptUploader({
  redemptionId,
  alreadyUploaded,
  initialPosReceiptNo,
}: {
  redemptionId: string;
  alreadyUploaded: boolean;
  initialPosReceiptNo: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<(Prepared & { originalSize: number; name: string }) | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posNo, setPosNo] = useState(initialPosReceiptNo);
  const [busy, setBusy] = useState<null | "preparing" | "uploading">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(file: File | undefined) {
    setError(null);
    setDone(false);
    setPrepared(null);
    if (!file) return;
    if (!(typeOf(file) in RECEIPT_TYPES)) return setError("Please choose a JPEG, PNG or HEIC photo.");
    if (file.size > MAX_ORIGINAL_BYTES) return setError("That photo is too large. Try another one.");
    setBusy("preparing");
    try {
      const p = await prepare(file);
      if (p.blob.size > RECEIPT_MAX_BYTES) throw new Error("Photo must be 8 MB or smaller.");
      setPrepared({ ...p, originalSize: file.size, name: file.name });
      setPreview(p.compressed ? URL.createObjectURL(p.blob) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that image.");
    }
    setBusy(null);
  }

  async function upload() {
    if (!prepared) return;
    setError(null);
    setBusy("uploading");
    try {
      const ticketRes = await fetch(`/api/redemptions/${redemptionId}/receipt/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: prepared.type, size: prepared.blob.size }),
      });
      const ticket = (await ticketRes.json()) as { ok: boolean; error?: string; key?: string; upload?: { url: string; method: "PUT"; headers: Record<string, string> } };
      if (!ticket.ok || !ticket.upload || !ticket.key) throw new Error(ticket.error ?? "Couldn't start the upload.");

      // Straight to storage with the presigned URL; our server never proxies the file.
      const put = await fetch(ticket.upload.url, { method: "PUT", headers: ticket.upload.headers, body: prepared.blob });
      if (!put.ok) throw new Error("Upload failed. Check your connection and try again.");

      const doneRes = await fetch(`/api/redemptions/${redemptionId}/receipt/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: ticket.key, posReceiptNo: posNo.trim() || undefined }),
      });
      const result = (await doneRes.json()) as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? "Upload failed.");
      setDone(true);
      setPrepared(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
    setBusy(null);
  }

  return (
    <section className="space-y-4 rounded-xl border p-4" aria-labelledby="receipt-h">
      <div>
        <h2 id="receipt-h" className="font-semibold">
          {alreadyUploaded ? "Receipt received" : "Upload the café's receipt"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {alreadyUploaded
            ? "Thanks! You can replace the photo until our team checks it."
            : "Take a clear photo of the printed POS receipt. It helps us settle with the café."}
        </p>
      </div>

      {done && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" role="status" data-testid="upload-done">
          Receipt uploaded. Thank you!
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="sr-only"
        onChange={(e) => void onPick(e.target.files?.[0])}
        data-testid="receipt-input"
      />
      <Button type="button" variant={prepared ? "outline" : "default"} className="h-12 w-full text-base" onClick={() => inputRef.current?.click()} disabled={!!busy}>
        {busy === "preparing" ? "Preparing photo…" : prepared ? "Choose a different photo" : alreadyUploaded ? "Replace photo" : "Take or choose photo"}
      </Button>

      {prepared && (
        <div className="space-y-3" data-testid="prepared">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimise it
            <img src={preview} alt="Receipt preview" className="max-h-80 w-full rounded-lg border object-contain" />
          )}
          <p className="text-muted-foreground text-xs" data-testid="prepared-info">
            {prepared.compressed
              ? `Resized to ${prepared.width}×${prepared.height}, ${kb(prepared.originalSize)} → ${kb(prepared.blob.size)}`
              : `${prepared.name} · ${kb(prepared.blob.size)} (sent as-is)`}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="pos">POS receipt number (optional)</Label>
        <Input id="pos" value={posNo} onChange={(e) => setPosNo(e.target.value)} maxLength={40} placeholder="e.g. 004512" className="h-11" />
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      <Button type="button" className="h-12 w-full text-base" onClick={upload} disabled={!prepared || !!busy} data-testid="upload">
        {busy === "uploading" ? "Uploading…" : "Upload receipt"}
      </Button>
    </section>
  );
}
