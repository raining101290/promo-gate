import { deskShot, phoneShot } from "@/lib/guide/shots";

import type { GuideStep } from "./types";

/**
 * Step-by-step walkthroughs with screenshots, one per staff workflow (shown first in each Help article).
 * Screenshots come from `npm run guide:shots`; the demo café is "Demo Bean House".
 */

export const JOURNEY: GuideStep[] = [
  {
    title: "The customer pays a hosting.com invoice",
    text: "**Upmind** (hosting.com billing) sends us the paid invoice. We issue a **Voucher** automatically from the campaign marked **Use for Upmind**, and Upmind emails the customer. If it can't be issued automatically, the request waits in **Requests** for support.",
    shot: deskShot("staff-requests", "Requests list with invoices received from Upmind"),
  },
  {
    title: "The customer logs in",
    text: "The customer logs in with the email hosting.com wrote to, using a one-time code, and sees the voucher.",
    shot: phoneShot("customer-voucher", "Customer's My vouchers page with an active voucher"),
  },
  {
    title: "Customer redeems at the café",
    text: "The customer scans the counter standee (`/r/<branch code>`), types the bill, and the cashier types the **branch PIN** on the customer's phone. The voucher becomes **Redeemed** and the café records it as **Hosting.com Voucher** in its POS.",
    shot: phoneShot("customer-success", "Green Voucher accepted screen on the customer's phone"),
  },
  {
    title: "Customer uploads the receipt",
    text: "From the green screen, the email link or the dashboard, the customer uploads a photo of the café receipt.",
    shot: phoneShot("customer-receipt", "Receipt upload page with the receipt photo"),
  },
  {
    title: "Support verifies the redemption",
    text: "In **Redemptions → To review**, support compares the photo with the amounts and verifies it. Only **Verified** redemptions are paid.",
    shot: deskShot("staff-redemption-review", "Redemption review page with the receipt photo and amounts"),
  },
  {
    title: "Finance pays the café",
    text: "Finance drafts a settlement per café, a second person approves it, the money is sent, and the settlement is marked **Paid** with the transfer reference.",
    shot: deskShot("staff-settlement-paid", "A settlement marked Paid with its payment reference"),
  },
];

export const REQUESTS_STEPS: GuideStep[] = [
  {
    title: "Open the Pending queue",
    text: "**Requests** lists every paid invoice, newest first. Upmind invoices that were issued automatically show **Automatic** under Reviewed by. Filter by **Pending** to see the ones that need you.",
    shot: deskShot("staff-requests", "Requests list filtered to Pending"),
  },
  {
    title: "Check why it's waiting",
    text: "Open **Review**. The yellow note says it came from Upmind; the **Upmind** page shows the reason (for example no campaign chosen, or the phone belongs to another account). Check the email and phone against the customer's hosting.com account.",
    shot: deskShot("staff-request-review", "Request review page with invoice, contacts and previous requests"),
  },
  {
    title: "Approve or reject",
    text: "**Approve** issues a voucher from the selected campaign and emails the customer. **Reject** needs a reason, which the customer sees. Either way the decision is final.",
    tip: "If Approve is refused, the table at the end of this article says why and what to do.",
    shot: deskShot("staff-request-approved", "Request after approval, showing the review outcome"),
  },
];

export const REDEMPTIONS_STEPS: GuideStep[] = [
  {
    title: "Open the To review tab",
    text: "**Redemptions → To review** lists redemptions whose receipt photo is waiting for a check. Warning badges flag anything unusual.",
    shot: deskShot("staff-redemptions", "Redemptions list on the To review tab"),
  },
  {
    title: "Compare the receipt with the amounts",
    text: "Open **Review**. The receipt should show the same café, a total equal to **Bill**, and a **Hosting.com Voucher** payment equal to the voucher amount.",
    shot: deskShot("staff-redemption-review", "Receipt photo beside the bill, voucher and POS receipt number"),
  },
  {
    title: "Verify, dispute or reject",
    text: "**Verify: receipt matches** makes it payable. **Dispute** puts it on hold while you ask the café or customer. **Reject** means it is never paid. Dispute and Reject need a reason.",
    tip: "No receipt after 24 hours? Confirm the sale with the café's POS record, then use **Verify without receipt** and write how you confirmed it.",
  },
];

export const SETTLEMENTS_STEPS: GuideStep[] = [
  {
    title: "Create a draft for a café",
    text: "**Settlements** shows each café with verified, unpaid redemptions and the amount owed. Pick the period on the café's row and click **Create draft**. The draft collects every **Verified** redemption in that period that isn't in another settlement yet.",
    shot: deskShot("staff-settlements", "Settlements page listing cafés with amounts owed"),
  },
  {
    title: "Check the draft",
    text: "The draft lists every redemption it pays, with branch, bill, voucher and POS receipt number. The total is the sum of the vouchers. **Download CSV statement** gives the café the same list.",
    shot: deskShot("staff-settlement-draft", "Draft settlement with its redemptions and total"),
  },
  {
    title: "A second person approves",
    text: "Another finance or admin user opens the draft and clicks **Approve**. The person who created it can't approve it (the four-eyes rule).",
  },
  {
    title: "Send the money, then mark it paid",
    text: "Pay the café by bank or bKash using **Pay to**. Enter the bank reference or bKash TrxID and click **Mark paid**.",
    shot: deskShot("staff-settlement-approved", "Approved settlement with the payment reference field"),
  },
  {
    title: "Done",
    text: "The settlement is closed and can't be changed. Its redemptions can't be paid twice.",
    shot: deskShot("staff-settlement-paid", "Paid settlement showing who approved and paid it"),
  },
];

export const PARTNERS_STEPS: GuideStep[] = [
  {
    title: "Add the café company",
    text: "**Partners** lists every café company with its branches and contract status. **New partner** adds one: name, contact, and where to send payouts.",
    shot: deskShot("staff-partners", "Partners list"),
  },
  {
    title: "Open the partner",
    text: "The partner page shows its branches and links to **Add branch**, **Print cashier guide**, and each branch's **Standee**.",
    shot: deskShot("staff-partner", "Partner page with its branches"),
  },
  {
    title: "Add a branch",
    text: "Enter the branch name, area, address and the **SMS phone** that gets a text for every redemption. Leave the branch code empty to generate one; it can't be changed later.",
    shot: deskShot("staff-branch-form", "New branch form"),
  },
  {
    title: "Give the PIN to the café",
    text: "The 4-digit PIN is shown **once**. Give it to the café manager privately. Lost or leaked? Use **Reset PIN** on the branch page.",
    shot: deskShot("staff-branch-pin", "Dialog showing the new branch PIN once"),
  },
  {
    title: "Print the standee and cashier guide",
    text: "Print the A6 standee at 100% scale and scan it once to check it opens this branch. Give the café the one-page cashier guide (English and Bangla).",
    shot: deskShot("staff-partner", "Partner page with Standee and Print cashier guide links"),
  },
];

export const CAMPAIGNS_STEPS: GuideStep[] = [
  {
    title: "See what's running",
    text: "**Campaigns** shows each offer, its dates, and how much of its budget is committed. Only active campaigns within their dates can issue vouchers.",
    shot: deskShot("staff-campaigns", "Campaigns list with budget use"),
  },
  {
    title: "Create or edit a campaign",
    text: "Choose a fixed amount or a percentage, then set the cap, minimum bill, dates, days each voucher stays valid, budget and per-customer limit. Changes never affect vouchers already issued.",
    shot: deskShot("staff-campaign-form", "New campaign form"),
  },
];

export const STAFF_STEPS: GuideStep[] = [
  {
    title: "Open Staff",
    text: "**Staff** lists everyone who can sign in to this admin, with their role and status.",
    shot: deskShot("staff-staff", "Staff list"),
  },
  {
    title: "Add a colleague",
    text: "Click **Add staff member**, enter their name and work email, and pick a role. A one-time password is shown **once**: send it privately.",
    shot: deskShot("staff-add-staff", "Add staff member dialog"),
  },
  {
    title: "They choose their own password",
    text: "At first sign-in they must set a new password of 12+ characters. Deactivate people who leave: it signs them out everywhere.",
  },
];

export const EMAIL_STEPS: GuideStep[] = [
  {
    title: "Search the customer's address",
    text: "Type the full address and click **Filter**. A **Sent** row means the provider accepted it; a **Failed** row shows the provider's reason.",
    shot: deskShot("staff-emails", "Email delivery log"),
  },
];

export const UPMIND_STEPS: GuideStep[] = [
  {
    title: "Check the status cards",
    text: "**Upmind** shows whether we're receiving invoices, which campaign vouchers come from, where redemption callbacks go, and how many callbacks are waiting or failed.",
    shot: deskShot("staff-upmind", "Upmind page with status cards, callbacks and received invoices"),
  },
];

export const AUDIT_STEPS: GuideStep[] = [
  {
    title: "Find who did what",
    text: "Every approval, receipt decision, payout, PIN reset, staff change and receipt view is listed with who, when and what changed.",
    shot: deskShot("staff-audit", "Audit log"),
  },
];
