import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/staff/print-button";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { getPartnerWithBranches } from "@/server/services/partners";

import { bangla } from "../../../print-fonts";

export const metadata = { title: "Cashier guide" };

const STEPS = [
  {
    en: "The customer scans the Hosting.com Coffee Campaign standee at the counter.",
    bn: "গ্রাহক কাউন্টারে রাখা Hosting.com Coffee Campaign স্ট্যান্ডিটি স্ক্যান করবেন।",
  },
  {
    en: "The customer shows the voucher amount on their phone. Check that it shows YOUR branch name.",
    bn: "গ্রাহক তাঁর ফোনে ভাউচারের পরিমাণ দেখাবেন। ফোনে আপনার শাখার নাম আছে কিনা দেখে নিন।",
  },
  {
    en: "Enter your branch PIN on the customer's phone. Don't say it aloud or let the customer see it.",
    bn: "গ্রাহকের ফোনে আপনার শাখার পিন দিন। পিন জোরে বলবেন না বা গ্রাহককে দেখাবেন না।",
  },
  {
    en: "In your POS, ring the voucher amount as payment type “Hosting.com Voucher”. Take the rest as usual.",
    bn: "আপনার POS-এ ভাউচারের পরিমাণ “Hosting.com Voucher” পেমেন্ট টাইপ হিসেবে নিন। বাকি টাকা স্বাভাবিকভাবে নিন।",
  },
  {
    en: "Give the customer the printed receipt.",
    bn: "গ্রাহককে প্রিন্ট করা রসিদটি দিন।",
  },
];

/** One-page A4 cashier guide per partner. Lists branches but never PINs. */
export default async function CashierGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage(PERMISSIONS.managePartners, `/admin/partners/${id}/cashier-guide`);
  const partner = await getPartnerWithBranches(id);
  if (!partner) notFound();
  const branches = partner.branches.filter((b) => b.active);

  return (
    <div className="space-y-4 print:space-y-0">
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="flex items-center gap-3 print:hidden">
        <Link href={`/admin/partners/${partner.id}`} className="text-muted-foreground text-sm hover:underline">
          ← {partner.name}
        </Link>
        <PrintButton label="Print cashier guide (A4)" />
      </div>

      <article
        data-testid="cashier-guide"
        className="mx-auto flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white px-[16mm] py-[14mm] text-neutral-900 shadow-lg ring-1 ring-neutral-200 print:shadow-none print:ring-0"
      >
        <header className="border-b-2 border-neutral-900 pb-[4mm]">
          <p className="text-[9pt] font-semibold tracking-[0.2em] text-neutral-500 uppercase">Hosting.com Coffee Campaign · {partner.name}</p>
          <h1 className="mt-[1mm] text-[22pt] leading-tight font-semibold">Cashier guide: Hosting.com Voucher</h1>
          <p className={`${bangla.className} text-[14pt]`}>ক্যাশিয়ার নির্দেশিকা: Hosting.com ভাউচার</p>
        </header>

        <ol className="mt-[6mm] space-y-[4.5mm]">
          {STEPS.map((s, i) => (
            <li key={s.en} className="flex gap-[4mm]">
              <span className="flex size-[9mm] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[14pt] font-semibold text-white">
                {i + 1}
              </span>
              <div className="pt-[0.5mm]">
                <p className="text-[12.5pt] leading-snug font-medium">{s.en}</p>
                <p className={`${bangla.className} mt-[0.5mm] text-[11pt] leading-snug text-neutral-700`}>{s.bn}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-[7mm] rounded-[2mm] border border-neutral-300 p-[5mm]">
          <h2 className="text-[11pt] font-semibold">Example</h2>
          <table className="mt-[2mm] w-full text-[11pt] tabular-nums">
            <tbody>
              <tr>
                <td className="py-[0.8mm]">Bill total</td>
                <td className="text-right">৳1,200</td>
              </tr>
              <tr>
                <td className="py-[0.8mm]">Payment type “Hosting.com Voucher” (amount shown on the phone)</td>
                <td className="text-right font-semibold">৳500</td>
              </tr>
              <tr className="border-t border-neutral-300">
                <td className="py-[0.8mm]">Customer pays by cash/card</td>
                <td className="text-right">৳700</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-[6mm] grid grid-cols-2 gap-[6mm] text-[10pt]">
          <div>
            <h2 className="font-semibold">Remember</h2>
            <ul className="mt-[1.5mm] list-disc space-y-[1mm] pl-[4.5mm]">
              <li>Each voucher works once. If the phone shows an error, don&apos;t accept the voucher.</li>
              <li>Never give the PIN to customers. If you think it has leaked, ask your manager to reset it.</li>
              <li>Hosting.com reimburses the voucher amounts in periodic settlements.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">Branches in this programme</h2>
            <ul className="mt-[1.5mm] space-y-[0.8mm]">
              {branches.map((b) => (
                <li key={b.id}>
                  {b.name} <span className="text-neutral-500">· {b.area}</span>
                </li>
              ))}
              {branches.length === 0 && <li className="text-neutral-500">No active branches yet.</li>}
            </ul>
          </div>
        </section>

        <footer className="mt-auto border-t border-neutral-200 pt-[3mm] text-[8.5pt] text-neutral-500">
          Keep this sheet near the till. Your branch PIN is given to the manager separately and is not printed here.
        </footer>
      </article>
    </div>
  );
}
