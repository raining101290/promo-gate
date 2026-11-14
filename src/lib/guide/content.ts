import { phoneShot, printShot } from "@/lib/guide/shots";
import type { GuideStep } from "@/lib/help/types";

/**
 * Public "How it works" guide (/guide for customers, /guide/cafes for partner cafés).
 * Screenshots come from `npm run guide:shots` (tests/guide). Text supports **bold** and `code`.
 */

/** Element screenshot sizes (CSS px), updated when the print layouts change. */
const STANDEE = { w: 398, h: 560 };
const CASHIER_GUIDE = { w: 794, h: 1123 };

export type GuideQA = { q: string; a: string };
export type GuidePart = { id: string; heading: string; intro?: string; steps: GuideStep[] };

export const CUSTOMER_GUIDE: GuidePart[] = [
  {
    id: "get-voucher",
    heading: "Get your voucher",
    intro: "Eligible hosting.com invoices earn a coffee voucher automatically. There's nothing to fill in.",
    steps: [
      {
        title: "Pay your hosting.com invoice",
        text: "When an eligible invoice is paid, hosting.com emails you that your coffee voucher is ready. Each paid invoice earns one voucher.",
      },
      {
        title: "Log in with that email",
        text: "Open this site and tap **Log in**. Enter the **email address hosting.com wrote to** and tap **Send code by email**. There is no password to remember.",
        shot: phoneShot("customer-login", "Log in page asking for the email address"),
      },
      {
        title: "Enter your login code",
        text: "We email you a 6-digit code. Type it in and tap **Verify and continue**.",
        tip: "The code works for 5 minutes. Check your spam or promotions folder if it doesn't arrive.",
        shot: phoneShot("customer-code", "Login code screen"),
      },
      {
        title: "Your voucher is ready",
        text: "After you log in, the voucher appears under **My vouchers** with its value and expiry date. Log in any time at this site to see it.",
        shot: phoneShot("customer-voucher", "My vouchers page showing an active ৳500 voucher"),
      },
      {
        title: "Check the terms",
        text: "Open the voucher to see the **minimum bill** and how many days are left. Use it before it expires; we remind you by email 3 days before.",
        shot: phoneShot("customer-voucher-detail", "Voucher details with value, minimum bill and expiry"),
      },
    ],
  },
  {
    id: "at-the-cafe",
    heading: "Use it at the café",
    intro: "Order as usual. When it's time to pay, tell the cashier you have a Hosting.com voucher.",
    steps: [
      {
        title: "Scan the QR code at the counter",
        text: "Point your phone camera at the **Hosting.com Coffee Campaign** standee by the till and open the link. Check that the page shows the café you're in.",
        tip: "Not logged in? The page asks you to log in first, then brings you back.",
        shot: phoneShot("customer-scan", "The café page after scanning, showing the café name and the voucher to use"),
      },
      {
        title: "Enter your bill",
        text: "Type the bill total the cashier gives you. The screen shows what the voucher pays and **what you pay**. Tap **Continue**.",
        shot: phoneShot("customer-bill", "Bill of ৳1,000 entered; voucher pays ৳500, you pay ৳500"),
      },
      {
        title: "Hand your phone to the cashier",
        text: "The cashier checks the amounts and types the café's **PIN** on your phone. Don't type it yourself.",
        shot: phoneShot("customer-pin", "The cashier screen with the amounts and a PIN pad"),
      },
      {
        title: "Show the green screen and pay the rest",
        text: "A green **Voucher accepted** screen with a live clock confirms the discount. Pay the remaining amount and take your printed receipt.",
        tip: "Your voucher is used at this moment, even if you leave without paying the rest.",
        shot: phoneShot("customer-success", "Green Voucher accepted screen with a live clock and the amounts"),
      },
    ],
  },
  {
    id: "receipt",
    heading: "Send us the receipt",
    intro: "The receipt photo lets us pay the café back. It takes a minute.",
    steps: [
      {
        title: "Photograph the receipt",
        text: "Tap **Upload receipt now** on the green screen, or use the link in the email we send you. Take a clear photo that shows the total and the **Hosting.com Voucher** line, then tap **Upload receipt**.",
        shot: phoneShot("customer-receipt", "Receipt upload page with a photo of the café receipt"),
      },
      {
        title: "That's it",
        text: "We check the receipt and mark it **Verified**. You can see the status on your dashboard.",
        shot: phoneShot("customer-receipt-done", "Confirmation that the receipt was uploaded"),
      },
    ],
  },
];

export const CUSTOMER_FAQ: GuideQA[] = [
  { q: "I paid but didn't get a voucher email.", a: "Only eligible invoices earn a voucher. If you think yours should, contact hosting.com support with your invoice number." },
  { q: "It says “No voucher found for this email”.", a: "Log in with the email address hosting.com wrote to. That's the address your voucher is linked to." },
  { q: "My login code didn't arrive.", a: "Check spam or promotions, then try again after a minute. You can ask for 3 codes every 15 minutes." },
  { q: "Can I use part of my voucher now and the rest later?", a: "No. A voucher is used once. If your bill is smaller than the voucher, the difference isn't kept." },
  { q: "The page says my bill is too small.", a: "Some vouchers need a minimum bill. Add something to your order or use the voucher another time." },
  { q: "It says “Too many wrong PINs”.", a: "After 5 wrong PINs the voucher is locked for 15 minutes to protect it. Wait, then ask the cashier to try again." },
  { q: "My voucher expired.", a: "Expired vouchers can't be used or extended. Each voucher shows its expiry date, and we remind you 3 days before." },
  { q: "Which cafés accept it?", a: "Any café with the Hosting.com Coffee Campaign standee at the counter. Scanning its QR code shows the café's name." },
  { q: "Can I download or delete my data?", a: "Yes. Log in and open **Your data & account** at the bottom of the My vouchers page." },
];

export const CAFE_GUIDE: GuidePart[] = [
  {
    id: "setup",
    heading: "What you get",
    intro: "No app, no account and no new device. Hosting.com sets up each branch with three things.",
    steps: [
      {
        title: "A counter standee with your branch QR code",
        text: "Place it next to the till where customers can scan it. Each branch has its own code, so keep each standee at its own branch.",
        shot: printShot("cafe-standee", "Printed counter standee with the branch QR code", STANDEE.w, STANDEE.h),
      },
      {
        title: "A branch PIN",
        text: "A 4-digit number for your cashiers only. Hosting.com gives it to you once. If it might have leaked, ask Hosting.com for a new one; the old PIN stops working immediately.",
      },
      {
        title: "A printed cashier guide",
        text: "One page in English and Bangla with the steps below. Keep it at the till.",
        shot: printShot("cafe-cashier-guide", "Printed cashier guide in English and Bangla", CASHIER_GUIDE.w, CASHIER_GUIDE.h),
      },
    ],
  },
  {
    id: "at-the-counter",
    heading: "At the counter",
    intro: "When a customer says they have a Hosting.com voucher:",
    steps: [
      {
        title: "Give the customer the bill total",
        text: "The customer scans your standee and types the total. Their phone shows the voucher amount and **your branch name**. Check it's your branch.",
        shot: phoneShot("customer-bill", "Customer's phone showing the bill, the voucher amount and what they pay"),
      },
      {
        title: "Type your branch PIN on the customer's phone",
        text: "Check the amounts on the dark cashier screen, then enter the PIN. Don't say it aloud or let the customer see it.",
        tip: "5 wrong PINs lock that voucher for 15 minutes.",
        shot: phoneShot("customer-pin", "Cashier screen with the amounts and the PIN pad"),
      },
      {
        title: "Check the green screen",
        text: "A real confirmation is **green**, says **Voucher accepted**, shows a **live clock** and a moving banner. A grey screen or a still picture is not valid for a new purchase.",
        shot: phoneShot("customer-success", "Green Voucher accepted screen with a live clock"),
      },
      {
        title: "Record it in your POS",
        text: "Ring the voucher amount as payment type **“Hosting.com Voucher”** and take the rest as usual. Give the customer the printed receipt.",
      },
    ],
  },
  {
    id: "getting-paid",
    heading: "Getting paid",
    steps: [
      {
        title: "Hosting.com checks each redemption",
        text: "The customer uploads a photo of your receipt, and Hosting.com checks it against the amounts. Recording the voucher as “Hosting.com Voucher” in your POS makes this quick.",
      },
      {
        title: "You're paid for every verified redemption",
        text: "Hosting.com pays your café company by bank or bKash. Each payment comes with a statement listing every redemption, branch and amount, plus the payment reference.",
      },
    ],
  },
];

export const CAFE_FAQ: GuideQA[] = [
  { q: "The customer's phone shows another café's name.", a: "They scanned a different standee. Ask them to go back and scan yours." },
  { q: "Our PIN may have leaked.", a: "Contact Hosting.com and ask for a new PIN. The old one stops working at once." },
  { q: "The customer shows a screenshot.", a: "Don't accept it. A real confirmation is green with a live, ticking clock. Older confirmations turn grey and say “Already used”." },
  { q: "The customer left without uploading the receipt.", a: "Keep your POS record of the “Hosting.com Voucher” payment. Hosting.com can confirm the sale from it." },
];
