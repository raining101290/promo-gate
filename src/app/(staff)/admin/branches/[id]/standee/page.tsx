import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { PrintButton } from "@/components/staff/print-button";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { branchRedeemUrl, getBranchForStaff } from "@/server/services/branches";

import { bangla } from "../../../print-fonts";

export const metadata = { title: "Standee" };

const STEPS = [
  { en: "Scan with your phone camera", bn: "ফোনের ক্যামেরা দিয়ে স্ক্যান করুন" },
  { en: "Enter your bill amount", bn: "বিলের পরিমাণ লিখুন" },
  { en: "Hand your phone to the cashier for the PIN", bn: "পিন দেওয়ার জন্য ফোনটি ক্যাশিয়ারকে দিন" },
];

/** Printable A6 counter standee. Encodes ${APP_URL}/r/<branchCode>. Never shows the PIN. */
export default async function StandeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage(PERMISSIONS.managePartners, `/admin/branches/${id}/standee`);
  const branch = await getBranchForStaff(id);
  if (!branch) notFound();

  const url = branchRedeemUrl(branch.branchCode);
  // Q-level error correction: a printed, handled standee survives scuffs and glare better.
  const qrSvg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "Q", margin: 0 });
  const shortUrl = url.replace(/^https?:\/\//, "");
  const blocked = !branch.active || branch.partner.contractStatus !== "ACTIVE";

  return (
    <div className="space-y-4 print:space-y-0">
      {/* A6 (105x148mm; Chrome has no "A6" keyword), no browser margins; only this sheet prints (sidebar is print:hidden in the layout). */}
      <style>{`@page { size: 105mm 148mm; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/admin/partners/${branch.partner.id}`} className="text-muted-foreground text-sm hover:underline">
          ← {branch.partner.name}
        </Link>
        <PrintButton label="Print standee (A6)" />
        <p className="text-muted-foreground text-sm">Print at 100% scale on A6, or A4 and trim. Laminate if possible.</p>
      </div>
      {blocked && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 print:hidden dark:bg-amber-950 dark:text-amber-200">
          This branch can&apos;t accept vouchers right now ({!branch.active ? "branch inactive" : `partner contract ${branch.partner.contractStatus.toLowerCase()}`}).
        </p>
      )}

      <article
        data-testid="standee"
        className="mx-auto flex h-[148mm] w-[105mm] flex-col items-center overflow-hidden bg-white px-[8mm] pt-[6mm] pb-[5mm] text-center text-neutral-900 shadow-lg ring-1 ring-neutral-200 print:shadow-none print:ring-0"
      >
        <p className="text-[9pt] font-semibold tracking-[0.2em] text-neutral-500 uppercase">Hosting.com Perks</p>

        <h1 className="mt-[2.5mm] text-[13.5pt] leading-tight font-semibold">Scan to use your Hosting.com voucher</h1>
        <p className={`${bangla.className} mt-[1mm] text-[10.5pt] leading-snug`}>আপনার Hosting.com ভাউচার ব্যবহার করতে স্ক্যান করুন</p>

        <div
          data-testid="standee-qr"
          className="mt-[3.5mm] w-[54mm] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          role="img"
          aria-label={`QR code linking to ${shortUrl}`}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-[2mm] font-mono text-[7.5pt] text-neutral-600">{shortUrl}</p>

        <ol className="mt-[3.5mm] w-full space-y-[1.2mm] text-left">
          {STEPS.map((s, i) => (
            <li key={s.en} className="flex gap-[2.5mm]">
              <span className="flex size-[5mm] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[7.5pt] font-semibold text-white">
                {i + 1}
              </span>
              <span className="leading-tight">
                <span className="block text-[8.5pt] font-medium">{s.en}</span>
                <span className={`${bangla.className} block text-[8pt] text-neutral-600`}>{s.bn}</span>
              </span>
            </li>
          ))}
        </ol>

        <footer className="mt-auto w-full border-t border-neutral-200 pt-[2.5mm]">
          <p className="text-[10pt] font-semibold">{branch.partner.name}</p>
          <p className="text-[8.5pt] text-neutral-600">
            {branch.name} · {branch.area}
          </p>
        </footer>
      </article>
    </div>
  );
}
