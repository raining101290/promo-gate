import type { HelpArticle } from "./types";

/**
 * Staff knowledge base. Numbers here mirror the code (rate-limit.ts, otp.ts, fraud-signals.ts,
 * redemptions.ts, receipt.ts...). tests/unit/help.test.ts checks the key ones so they can't drift.
 * Keep the tone plain: support staff read this while a customer is waiting.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  // ---------------------------------------------------------------- Start here
  {
    slug: "how-it-works",
    title: "How Hosting.com Perks works",
    summary: "The whole programme in five minutes: who does what, from invoice to café payout.",
    category: "Start here",
    roles: ["SUPPORT", "FINANCE", "ADMIN"],
    sections: [
      {
        id: "idea",
        heading: "The idea",
        blocks: [
          {
            kind: "p",
            text: "Hosting.com customers who paid an invoice get a coffee voucher. They use it at partner cafés in Bangladesh. The café gives the discount at the counter, and Hosting.com pays the café back later. That last step is a **settlement**.",
          },
          {
            kind: "p",
            text: "Café staff have **no accounts**. Their only touchpoint is the 4-digit **branch PIN**, which the cashier types on the customer's phone to confirm the discount.",
          },
        ],
      },
      {
        id: "journey",
        heading: "The journey, step by step",
        blocks: [
          {
            kind: "steps",
            items: [
              "**Customer submits** their invoice number, email and phone on the home page. This creates a Request with status **Pending**.",
              "**Support reviews** the request in **Requests** against the billing system, then approves or rejects it. Approving issues a **Voucher** from the chosen Campaign.",
              "**Customer logs in** with a one-time code (OTP) sent by **email**, and sees the active voucher.",
              "**At the café**, the customer scans the QR on the counter **standee**, which opens `/r/<branch code>`. They type the bill amount, and the screen shows the discount.",
              "**The cashier types the branch PIN** on the customer's phone. The voucher becomes **Redeemed** and the phone shows a green success screen. The branch also gets an SMS with the amounts and a reference like `R-7K2M9Q`.",
              'The café rings up the discount in its POS as payment type **"Hosting.com Voucher"**.',
              "**Customer uploads** a photo of the POS receipt, from the link in their SMS/email or from their dashboard.",
              "**Support verifies** the receipt in **Redemptions**. Only Verified redemptions are paid.",
              "**Finance settles**: they create a draft per partner, a second person approves it, the café is paid, and the settlement is marked **Paid** with the bank/bKash reference.",
            ],
          },
        ],
      },
      {
        id: "roles",
        heading: "Who does what",
        blocks: [
          {
            kind: "table",
            head: ["Role", "Main job", "Screens"],
            rows: [
              ["Support", "Approve invoices; check receipts; answer customers", "Requests, Redemptions, SMS, Help"],
              [
                "Finance",
                "Pay cafés: draft, approve (four-eyes) and mark settlements paid",
                "Redemptions (view), Partners (view), Settlements, SMS, Help",
              ],
              ["Admin", "Set up campaigns, cafés, branches, PINs and staff; everything else too", "All screens, including Staff and Audit log"],
            ],
          },
        ],
      },
      {
        id: "money",
        heading: "Where the money goes",
        blocks: [
          {
            kind: "p",
            text: "The customer pays the café **bill minus discount**. Hosting.com owes the café the **discount** of each verified redemption. A settlement total is always the sum of those discounts.",
          },
          {
            kind: "note",
            tone: "info",
            text: "All amounts are stored in whole paisa (৳1 = 100 paisa), so totals never have rounding errors. All times are shown in Dhaka time.",
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Screens
  {
    slug: "requests",
    title: "Requests: approving invoices",
    summary: "What each field on a request means, how to decide, and what each reject reason tells the customer.",
    category: "Screens",
    roles: ["SUPPORT", "ADMIN"],
    screen: "/admin/requests",
    sections: [
      {
        id: "purpose",
        heading: "What this screen is for",
        blocks: [
          {
            kind: "p",
            text: "Each row is one invoice a customer submitted. Your job is to confirm in the billing system that the invoice is real, **paid** and belongs to that customer. Approve it to issue a voucher, or reject it with a reason. The list is newest first, and the search box matches invoice number, email or phone.",
          },
        ],
      },
      {
        id: "fields",
        heading: "Fields",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "Invoice number",
                why: "The key you look up in billing. Each invoice can be submitted only once, so the same invoice can never earn two vouchers.",
                tip: 'The form shows "This invoice has already been submitted" for duplicates.',
              },
              {
                name: "Submitted email / phone",
                why: "What the customer typed. Compare them with the contact on the invoice. A mismatch is the most common sign someone is using another person's invoice.",
              },
              {
                name: "Customer account",
                why: "The account the request is attached to, plus the email/phone it can log in with. Codes are only ever sent to these contacts.",
              },
              {
                name: "Previous requests by this customer",
                why: "Shows repeat claims. A customer with many approved requests in a short time is worth a closer look.",
              },
              {
                name: "Campaign (when approving)",
                why: "Decides the voucher's terms: amount, minimum bill, validity. The voucher keeps a copy of these terms, so editing the campaign later never changes vouchers already issued.",
              },
              {
                name: "Reject reason",
                why: "Shown to the customer, so pick the closest one. Use **Other** only with a clear note.",
              },
            ],
          },
        ],
      },
      {
        id: "reasons",
        heading: "Reject reasons",
        blocks: [
          {
            kind: "table",
            head: ["Reason", "Use it when"],
            rows: [
              ["We couldn't find this invoice", "No such invoice number in billing (often a typo)"],
              ["This invoice is not paid yet", "Invoice exists but is unpaid, cancelled or refunded"],
              ["The email or phone doesn't match the invoice", "Invoice is real, but the contact details belong to someone else"],
              ["This purchase isn't eligible for the promotion", "Product or date is outside the promotion rules"],
              ["An offer was already issued for this purchase", "Same purchase claimed under a different invoice number"],
              ["Other", "Anything else; explain in the note"],
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "A rejected invoice can't be resubmitted with the same number. If you rejected by mistake, ask an admin; don't tell the customer to resubmit.",
          },
        ],
      },
      {
        id: "approve-errors",
        heading: "When Approve is refused",
        blocks: [
          {
            kind: "table",
            head: ["Message", "What it means / what to do"],
            rows: [
              [
                "Campaign budget exhausted",
                "The campaign's total budget can't cover one more voucher. An admin raises the budget or you choose another campaign.",
              ],
              [
                "Customer limit reached",
                'This customer already holds the maximum vouchers for this campaign. Reject as "already issued" or use another campaign if policy allows.',
              ],
              ["Campaign inactive / not started / ended", "Pick a running campaign, or ask an admin to fix the dates or switch it on."],
              ["Already reviewed", "Someone else handled it seconds before you. Refresh the page."],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "redemptions",
    title: "Redemptions: checking receipts",
    summary: "The review queue, every tab and column, fraud badges, and when to verify, dispute or reject.",
    category: "Screens",
    roles: ["SUPPORT", "FINANCE", "ADMIN"],
    screen: "/admin/redemptions",
    sections: [
      {
        id: "purpose",
        heading: "What this screen is for",
        blocks: [
          {
            kind: "p",
            text: "Every time a voucher is used at a café, a redemption is created. Support compares the customer's receipt photo with the amounts recorded at the counter. **Only Verified redemptions are paid to the café**, so this check protects Hosting.com's money.",
          },
        ],
      },
      {
        id: "tabs",
        heading: "Tabs",
        blocks: [
          {
            kind: "table",
            head: ["Tab", "Contains", "Your action"],
            rows: [
              ["To review", "Receipt uploaded, waiting for a check", "Open the receipt; verify, dispute or reject"],
              ["No receipt yet", 'Redeemed, no photo yet (badge "Receipt needed")', "Usually nothing. The customer has a link to upload."],
              [
                "No receipt 24h+",
                "Still no photo 24 hours after redemption",
                "Remind the customer; if none comes, confirm with the café and Verify without receipt (see playbook)",
              ],
              ["Disputed", "Something didn't match; on hold", "Resolve with the customer/café, then verify or reject"],
              ["Verified", "Checked and ready for settlement", "Nothing (Finance picks these up)"],
              ["Rejected", "Will never be paid", "Nothing"],
            ],
          },
        ],
      },
      {
        id: "fields",
        heading: "Columns",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "Ref (R-XXXXXX)",
                why: "Short reference shown on the customer's success screen and in the branch SMS. Use it when you talk to a café or a customer.",
              },
              {
                name: "Bill",
                why: "What the customer typed as the full bill. Must match the receipt total.",
              },
              {
                name: "Discount",
                why: "What the voucher took off: the amount Hosting.com will pay the café.",
              },
              {
                name: "Customer paid",
                why: "Bill minus discount. The café should have charged this in cash/card.",
              },
              {
                name: "Branch / partner",
                why: "Where the PIN was entered. The receipt should show the same café.",
              },
              {
                name: "Redeemed at",
                why: "Dhaka time of the PIN entry. The receipt time should be close to it.",
              },
              {
                name: "Receipt",
                why: "Opens the photo through a short-lived link. Every view is written to the audit log.",
              },
              {
                name: "Badges",
                why: "Automatic warning signs (below). They never block anything; they just ask you to look more carefully.",
              },
            ],
          },
        ],
      },
      {
        id: "check",
        heading: "How to check a receipt",
        blocks: [
          {
            kind: "steps",
            items: [
              "Café name on the receipt matches the branch's partner.",
              "Receipt total equals **Bill**.",
              "Payment line shows **Hosting.com Voucher** for the discount amount.",
              "Date/time is close to **Redeemed at**.",
              "Photo is readable and not reused (the same receipt number on two redemptions is a red flag).",
            ],
          },
          {
            kind: "table",
            head: ["Outcome", "Use when", "Effect"],
            rows: [
              ["Verify", "Everything matches", "Ready to pay in Settlements. Final."],
              [
                "Verify without receipt",
                "No photo, but the café confirmed the sale (its POS shows the Hosting.com Voucher payment for this time and amount)",
                "Same as Verify. Your note is saved and the audit log marks it as verified without receipt.",
              ],
              [
                "Dispute",
                "Something is off but may be explained (e.g. small amount difference the café must confirm)",
                "On hold, uploads closed. Write a note. Later verify or reject.",
              ],
              ["Reject", "Clearly wrong, fake or not our voucher", "Never paid. Final. Write a note."],
            ],
          },
          {
            kind: "note",
            tone: "warn",
            text: "Verifying without a receipt needs a written reason saying how you confirmed the sale. Never verify on the customer's word alone. A redemption that is already in a settlement can't be changed.",
          },
        ],
      },
      {
        id: "badges",
        heading: "Fraud badges",
        blocks: [
          {
            kind: "table",
            head: ["Badge (example)", "Rule", "Why it matters"],
            rows: [
              ["⚠ Repeat customer", "Same customer redeemed again within 1 hour", "Several vouchers for one table/order"],
              [
                "⚠ Bill 3.4× avg",
                "Bill is 3× or more the branch's average (after 5+ redemptions there, last 90 days)",
                "Inflated bill to max out a percent discount",
              ],
              ["⚠ Off-hours 23:40", "Redeemed between 23:00 and 07:00 Dhaka time", "Café likely closed"],
              ["⚠ 6 PIN failures", "5+ wrong PINs at this branch in the 24 hours before", "Someone may have guessed the PIN; consider resetting it"],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "partners-branches",
    title: "Partners, branches, PINs & standees",
    summary: "Setting up a café: why each field exists, how PINs work, printing the counter standee.",
    category: "Screens",
    roles: ["ADMIN", "FINANCE", "SUPPORT"],
    screen: "/admin/partners",
    sections: [
      {
        id: "partner",
        heading: "Partner (the café company)",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "Partner name",
                why: "The company we pay. Shown on settlements and the CSV statement.",
              },
              {
                name: "Contact person / phone",
                why: "Who finance or support calls about payments and disputes.",
              },
              {
                name: "Payout method + account",
                why: "Bank transfer or bKash, and where to send the money. Finance copies this when paying a settlement.",
                tip: "For bank: bank, branch, account name and number on one line.",
              },
              {
                name: "Contract status",
                why: '**Active**: all its active branches accept vouchers. **Paused**: no redemptions for now (e.g. contract renewal). **Ended**: relationship over. Paused/Ended branches show "not accepting vouchers" when scanned.',
              },
            ],
          },
        ],
      },
      {
        id: "branch",
        heading: "Branch (one café location)",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "Branch name / area / address",
                why: "Shown to the customer on the redemption screen so they know they scanned the right café.",
              },
              {
                name: "SMS phone (redemption alerts)",
                why: "Gets an SMS for every redemption with bill, discount, customer pays and the ref. Use the counter or manager's phone. It is never shown to customers.",
              },
              {
                name: "Branch code",
                why: "The short code in the QR link (`/r/<code>`). **It can't be changed after creation**, because it's printed on the standee. Leave empty to auto-generate one.",
              },
              {
                name: "Active",
                why: "Switch off to stop one location (renovation, closed) without touching the partner.",
              },
            ],
          },
        ],
      },
      {
        id: "pin",
        heading: "Branch PIN",
        blocks: [
          {
            kind: "list",
            items: [
              "The system generates a 4-digit PIN when the branch is created. It is **shown once**: write it down or give it to the café manager straight away. We store only a scrambled (hashed) form, so nobody can look it up later.",
              "Lost or leaked PIN → **Reset PIN** on the branch page. The old PIN stops working immediately, and the new one is shown once.",
              "After 5 wrong PINs within 15 minutes, that voucher is locked for 15 minutes. This stops guessing at the counter.",
              "Give the PIN only to cashiers. Customers must never see it.",
            ],
          },
        ],
      },
      {
        id: "standee",
        heading: "Standee & cashier guide",
        blocks: [
          {
            kind: "p",
            text: 'On the branch page, **Print standee** opens an A6 (105 × 148 mm) card with the branch QR. Print it at 100% scale, not "fit to page". **Cashier guide** is a one-page explainer for café staff: how to check the screen, type the PIN and record **Hosting.com Voucher** in the POS.',
          },
          {
            kind: "note",
            tone: "info",
            text: "Scan the printed QR once with a phone before delivering it: it must open this branch's page.",
          },
        ],
      },
    ],
  },
  {
    slug: "campaigns",
    title: "Campaigns: offer terms & budgets",
    summary: "Fixed vs percent offers, caps, minimum bill, validity, budgets, and how the discount is calculated.",
    category: "Screens",
    roles: ["ADMIN"],
    screen: "/admin/campaigns",
    sections: [
      {
        id: "fields",
        heading: "Fields",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "Name",
                why: 'Internal label chosen at approval time, e.g. "Launch Offer - 500 BDT".',
              },
              {
                name: "Offer type",
                why: "**Fixed**: a set taka amount off. **Percent**: a percentage of the bill, with a cap.",
              },
              {
                name: "Amount off / Percentage off",
                why: "The value of the offer. Percent supports decimals (12.5%).",
              },
              {
                name: "Maximum discount",
                why: 'Percent offers only, required. The most one voucher can ever take off. It is also what the voucher "costs" the budget.',
              },
              {
                name: "Minimum bill",
                why: "Optional. Bills below this are refused at the café, so tiny orders don't get a full discount.",
              },
              {
                name: "Voucher validity (days)",
                why: "How long a voucher lasts from the moment it is approved (1–365). Customers get a reminder 3 days before expiry.",
              },
              {
                name: "Total budget",
                why: "Optional cap on the sum of all vouchers' face values (fixed amount, or the max discount for percent). Approvals stop when it's used up.",
              },
              {
                name: "Vouchers per customer",
                why: "Optional. Stops one customer collecting many vouchers from the same campaign.",
              },
              {
                name: "Starts / Ends (Dhaka time)",
                why: "Approvals are only allowed inside this window. Ends can be empty for no end date. Vouchers already issued still work until their own expiry.",
              },
              {
                name: "Active",
                why: "Quick on/off switch for approvals, without changing dates.",
              },
            ],
          },
        ],
      },
      {
        id: "math",
        heading: "How the discount is calculated",
        blocks: [
          {
            kind: "table",
            head: ["Voucher", "Bill", "Discount", "Customer pays"],
            rows: [
              ["Fixed ৳500", "৳850", "৳500", "৳350"],
              ["Fixed ৳500", "৳320", "৳320 (never more than the bill)", "৳0"],
              ["15%, max ৳300", "৳1,200", "৳180", "৳1,020"],
              ["15%, max ৳300", "৳3,000", "৳300 (capped)", "৳2,700"],
              ["Any, min bill ৳400", "৳350", "Refused: below minimum", "—"],
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Percent discounts round down to the nearest paisa, so customers never get a fraction of a paisa more than the rule.",
          },
          {
            kind: "note",
            tone: "warn",
            text: "Editing a campaign only affects vouchers approved afterwards. Issued vouchers keep the terms they were issued with.",
          },
        ],
      },
    ],
  },
  {
    slug: "settlements",
    title: "Settlements: paying cafés",
    summary: "Draft → Approved → Paid, the four-eyes rule, the CSV statement, and payment references.",
    category: "Screens",
    roles: ["FINANCE", "ADMIN"],
    screen: "/admin/settlements",
    sections: [
      {
        id: "flow",
        heading: "The three steps",
        blocks: [
          {
            kind: "steps",
            items: [
              "**Create draft**: pick a partner and a period. The draft collects every **Verified** redemption of that partner in the period that isn't in another settlement yet. The total is the sum of their discounts.",
              "**Approve**: a **different** finance/admin user checks the draft and approves it. The person who created the draft can't approve it (the four-eyes rule).",
              "**Mark paid**: after sending the money, record the bank transaction reference or bKash TrxID. A Paid settlement can never be changed.",
            ],
          },
        ],
      },
      {
        id: "fields",
        heading: "Fields",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "Ready to pay (overview)",
                why: "Per partner: verified, unsettled discounts waiting for a draft.",
              },
              {
                name: "Period start / end",
                why: "Which redemptions to include, by redemption date (Dhaka). Usually a calendar month or fortnight, as agreed in the contract.",
              },
              {
                name: "Total",
                why: "Sum of included discounts. This is the amount to transfer.",
              },
              {
                name: "Created / Approved / Paid by",
                why: "Who did each step and when. Together with the audit log, this is the paper trail for accounting.",
              },
              {
                name: "Payment reference",
                why: "Bank transaction ref or bKash TrxID. Lets anyone trace the transfer later.",
              },
              {
                name: "Download CSV statement",
                why: "Line-by-line list (ref, branch, date, bill, discount) to send to the café with the payment.",
              },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Redemptions that are still Receipt needed, To review or Disputed are not included. They join a later settlement once verified.",
          },
        ],
      },
    ],
  },
  {
    slug: "sms",
    title: "SMS: credit & delivery log",
    summary: "Check gateway credit, find out whether a customer's code was sent, and what each gateway error means.",
    category: "Screens",
    roles: ["SUPPORT", "FINANCE", "ADMIN"],
    screen: "/admin/sms",
    sections: [
      {
        id: "purpose",
        heading: "What this screen is for",
        blocks: [
          {
            kind: "p",
            text: "Every SMS the app sends (login codes, branch alerts, receipt links, expiry reminders) is recorded here, **one row per attempt**. When a customer says \"the code never arrived\", search their number: you'll see whether we sent it and, if not, the gateway's exact reason.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Message text is never shown here: login codes are never stored at all, and other messages can contain amounts or private upload links. Phone numbers are partly hidden.",
          },
        ],
      },
      {
        id: "fields",
        heading: "Fields",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "Gateway credit",
                why: "Prepaid balance at BulkSMSBD, in taka. It turns amber when it is low. At zero, **no login codes or branch alerts go out**, so top up before that.",
                tip: "The figure is refreshed at most once a minute.",
              },
              {
                name: "Sent / Failed, last 24h",
                why: "Quick health check. A sudden jump in failures usually means credit, sender ID or IP-whitelist trouble (see codes below).",
              },
              { name: "To", why: "The number the SMS went to, partly hidden. Search with the full number to filter." },
              {
                name: "Type",
                why: "Login code, Branch alert (to the café, with the ref), Receipt link (to the customer after redeeming), Expiry reminder.",
              },
              {
                name: "Try",
                why: "Temporary errors are retried up to 3 times; each try is its own row. Permanent errors (bad number, no credit) stop after the first try.",
              },
              {
                name: "Gateway reply",
                why: "For failures, the gateway code and reason. For successes, the provider name and its message reference.",
              },
            ],
          },
        ],
      },
      {
        id: "codes",
        heading: "Gateway error codes",
        blocks: [
          {
            kind: "table",
            head: ["Code", "Meaning", "What to do"],
            rows: [
              ["1001", "Invalid number", "Customer/branch number is wrong. Check it; customers can log in by email instead."],
              ["1002, 1013–1017", "Sender ID wrong, disabled or not priced", "Admin: check the sender ID with BulkSMSBD."],
              ["1007, 1006", "Balance insufficient / expired", "Admin/finance: top up the BulkSMSBD account."],
              [
                "1012",
                "Masking SMS must be in Bengali",
                "Admin: the sender ID is a masking ID with a Bengali-only rule; ask BulkSMSBD to allow English.",
              ],
              ["1018–1021, 1011, 1031", "Gateway account problem", "Admin: contact BulkSMSBD."],
              ["1032", "Server IP not whitelisted", "Admin: whitelist the server's IP address in the BulkSMSBD panel (the error names the IP)."],
              ["1003", "Required field missing", "Configuration problem (API key or sender ID empty). Admin: check the SMS settings."],
              ["1005, network", "Temporary gateway/network problem", "Retried automatically. If it persists, contact BulkSMSBD."],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "staff",
    title: "Staff accounts & roles",
    summary: "Adding colleagues, roles and permissions, temporary passwords, deactivating.",
    category: "Screens",
    roles: ["ADMIN"],
    screen: "/admin/staff",
    sections: [
      {
        id: "permissions",
        heading: "What each role can do",
        blocks: [
          {
            kind: "table",
            head: ["Permission", "Support", "Finance", "Admin"],
            rows: [
              ["Review invoice requests", "✓", "", "✓"],
              ["View redemptions", "✓", "✓", "✓"],
              ["Verify / dispute / reject redemptions", "✓", "", "✓"],
              ["View partners & branches", "", "✓", "✓"],
              ["Create/edit partners, branches, PINs", "", "", "✓"],
              ["Campaigns", "", "", "✓"],
              ["View settlements", "", "✓", "✓"],
              ["Create, approve, pay settlements", "", "✓", "✓"],
              ["SMS credit & delivery log", "✓", "✓", "✓"],
              ["Audit log", "", "", "✓"],
              ["Manage staff", "", "", "✓"],
            ],
          },
        ],
      },
      {
        id: "fields",
        heading: "Fields and actions",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "Name",
                why: 'Shown in audit entries and on settlements ("Approved by").',
              },
              {
                name: "Work email",
                why: "Their sign-in name. Must be unique.",
              },
              {
                name: "Role",
                why: "Decides which screens they see. A change takes effect on their very next click.",
              },
              {
                name: "Temporary password",
                why: "Shown **once** after Add or Reset password. Send it privately (not in a group chat). They must choose their own password (12+ characters) at first sign-in.",
              },
              {
                name: "Deactivate",
                why: "For people who leave. Signs them out everywhere and blocks sign-in, while keeping their name on past records. Prefer this over deleting.",
              },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "You can't change your own role or deactivate yourself, and the last active admin can't be demoted. This guarantees someone can always manage staff.",
          },
        ],
      },
    ],
  },
  {
    slug: "audit-log",
    title: "Audit log",
    summary: "What gets recorded and how to read an entry.",
    category: "Screens",
    roles: ["ADMIN"],
    screen: "/admin/audit",
    sections: [
      {
        id: "purpose",
        heading: "What it's for",
        blocks: [
          {
            kind: "p",
            text: 'A permanent, read-only record of important actions: who did what, to which record, when, and any details (for example a role change "from Support to Finance"). Use it to answer "who approved this?", "when was this PIN reset?" or "who looked at this receipt?".',
          },
        ],
      },
      {
        id: "actions",
        heading: "Common actions",
        blocks: [
          {
            kind: "table",
            head: ["Action", "Meaning"],
            rows: [
              ["offer_request.submitted / approved / rejected", "Invoice claim lifecycle"],
              ["voucher.redeemed", "PIN accepted at a café"],
              ["voucher.pin_failed / pin_locked", "Wrong PIN typed / voucher locked for 15 min"],
              ["voucher.expired_batch", "Hourly job expired old vouchers"],
              ["redemption.receipt_uploaded / receipt_viewed", "Customer uploaded a photo / staff opened it"],
              ["settlement.created / approved / paid", "Settlement steps"],
              ["branch.created / branch.pin_reset", "Café setup and PIN changes"],
              ["campaign.created / updated, partner.created", "Setup changes"],
              ["staff.created / role_changed / password_reset / deactivated", "Staff management"],
              ["customer.data_exported / deleted", "Customer privacy requests"],
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: 'Actor "System" means an automatic job; "Customer" means the customer did it themselves.',
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Support playbook
  {
    slug: "playbook-login",
    title: "Customer can't log in",
    summary: 'No code arrived, code rejected, "No offers found", too many attempts.',
    category: "Support playbook",
    roles: ["SUPPORT", "ADMIN"],
    sections: [
      {
        id: "how",
        heading: "How login works",
        blocks: [
          {
            kind: "list",
            items: [
              "Customers don't have passwords. They type their **email address** and get a **6-digit code by email**, valid for **5 minutes**. (Login by SMS is switched off for now; if it is switched on later, the login screen shows a Mobile (SMS) / Email choice.)",
              "They do **not** need the invoice number to log in. The invoice is only for claiming a new voucher.",
              "A code goes only to a contact already on the account. Typing a new email/phone never changes the account (this stops account takeover).",
              "Once logged in, a customer stays signed in on that phone for 30 days.",
            ],
          },
        ],
      },
      {
        id: "cases",
        heading: "Cases",
        blocks: [
          {
            kind: "table",
            head: ["Customer says", "Likely cause", "What to do"],
            rows: [
              [
                '"No offers found for this email/phone"',
                "They used a contact that isn't on any request, or nothing was submitted yet",
                "Search Requests by email/phone. Ask them to use the contact they submitted with.",
              ],
              [
                '"The code never arrived"',
                "Spam/promotions folder, typo in the email address, or a different email than the one on the invoice",
                'Ask them to check spam/promotions and search their inbox for "Hosting.com Perks login code". Search Requests by their email to confirm which address is on file.',
              ],
              [
                '"Too many attempts"',
                "3 codes per 15 min per contact, or 5 wrong tries on one code",
                "Wait 15 minutes, then request one fresh code and use only the newest.",
              ],
              ['"Code expired"', "Older than 5 minutes, or a newer code was requested", "Request a new code and use it straight away."],
            ],
          },
          {
            kind: "reply",
            label: "Reply: code not arriving",
            text: "Hi! Login codes are emailed to the address you used when you submitted your invoice. Please check your spam/promotions folder and search for \"Hosting.com Perks login code\". Each code works for 5 minutes. If you've requested several, please wait 15 minutes and try once more. You don't need your invoice number to log in.",
          },
        ],
      },
    ],
  },
  {
    slug: "playbook-voucher",
    title: "Voucher problems at the café",
    summary: "Not accepted, PIN locked, bill too small, expired, wrong branch.",
    category: "Support playbook",
    roles: ["SUPPORT", "ADMIN"],
    sections: [
      {
        id: "cases",
        heading: "Cases",
        blocks: [
          {
            kind: "table",
            head: ["What happened", "Why", "What to do"],
            rows: [
              [
                '"Too many wrong PINs. This voucher is locked for N minutes."',
                "5 wrong PINs in 15 minutes locked this voucher",
                "Wait 15 minutes. Make sure the **cashier** types the PIN. If the café says the PIN is right, an admin should check/reset the branch PIN.",
              ],
              [
                '"This café isn\'t accepting Hosting.com vouchers right now."',
                "Branch inactive or partner Paused/Ended",
                "Suggest another partner café. Tell an admin if this looks wrong.",
              ],
              [
                '"This voucher needs a bill of at least ৳X."',
                "Bill below the campaign's minimum",
                "Customer can add items, or use the voucher another time.",
              ],
              [
                "Voucher not shown / expired",
                "Validity ended (reminder was sent 3 days before)",
                "Expired vouchers can't be revived in the app. Escalate to an admin only if policy allows a goodwill re-issue.",
              ],
              ["Scanned QR opens the wrong café", "Wrong or swapped standee", "Note the branch, tell an admin to reprint. Don't redeem."],
              [
                "Customer typed the wrong bill and confirmed",
                "Redemption already created",
                "Find it by ref in Redemptions; dispute with a note. Verify only if the receipt shows the real bill.",
              ],
            ],
          },
          {
            kind: "reply",
            label: "Reply: PIN locked",
            text: "Sorry about that! For security, a voucher pauses for 15 minutes after 5 incorrect PINs. Your voucher is safe and still active. After 15 minutes, please ask the cashier to enter the café's PIN on your phone.",
          },
        ],
      },
    ],
  },
  {
    slug: "playbook-receipt",
    title: "Receipt uploads",
    summary: "How customers upload, missing receipts, unreadable photos.",
    category: "Support playbook",
    roles: ["SUPPORT", "ADMIN"],
    sections: [
      {
        id: "why",
        heading: "Why we need the receipt",
        blocks: [
          {
            kind: "p",
            text: "The receipt is the quickest proof that the café gave the discount on a real bill. Customers get the upload link by email right after redeeming, and it's also on their dashboard under the redemption. Many customers won't bother once they've paid, but **the café must still be paid**: the cashier's PIN already shows the café accepted the voucher. So when no photo comes, confirm the sale with the café and use **Verify without receipt**.",
          },
        ],
      },
      {
        id: "cases",
        heading: "Cases",
        blocks: [
          {
            kind: "list",
            items: [
              "Accepted: JPEG, PNG or HEIC photos up to 8 MB. Phones shrink them automatically before upload.",
              "Customers can replace the photo while it is **Receipt needed** or **Receipt sent** (up to 10 uploads per hour). Once it is Disputed, Verified or Rejected, uploads are closed.",
              '**No receipt after 24 hours** → appears in the "No receipt 24h+" tab. Send the reminder below. If nothing comes (or the customer lost it), ask the café to check its POS for a Hosting.com Voucher payment at that time and amount (give them the ref, time, bill and discount). If the payment is there, **Verify without receipt** and note how the café confirmed it. If the café has no record, dispute it.',
              "**Blurry or cut-off** photo → **don't dispute yet**: ask the customer to upload a clearer one (the reply below) and review the new photo. Dispute only if no usable photo comes; disputed redemptions can't receive new uploads.",
            ],
          },
          {
            kind: "reply",
            label: "Reply: please upload receipt",
            text: 'Hi! Thanks for using your Hosting.com coffee voucher. Could you upload a clear photo of the café receipt? Open your Perks dashboard and tap "Upload" under "Receipt photo needed" (or use the link in the SMS/email we sent after your visit). Make sure the total and the "Hosting.com Voucher" line are visible. Thank you!',
          },
        ],
      },
    ],
  },
  {
    slug: "playbook-account",
    title: "Invoices, contacts & privacy requests",
    summary: "Rejected invoices, changing email/phone, data export and account deletion.",
    category: "Support playbook",
    roles: ["SUPPORT", "ADMIN"],
    sections: [
      {
        id: "cases",
        heading: "Cases",
        blocks: [
          {
            kind: "table",
            head: ["Customer asks", "What to do"],
            rows: [
              ['"Why was my invoice rejected?"', "Open the request; the reason is there. If billing shows you were wrong, escalate to an admin."],
              [
                '"This invoice has already been submitted"',
                "Search Requests by invoice number. If a different person submitted it, treat as possible misuse and check the contacts.",
              ],
              [
                '"Email and phone belong to two different accounts"',
                "They mixed contacts from two accounts. Ask them to submit with the email + phone from one account.",
              ],
              [
                '"Please change my email/phone"',
                "The app never changes contacts from public forms (to stop takeover). Verify identity through Hosting.com's normal process, then escalate.",
              ],
              ['"Send me my data"', "Dashboard → Account → Download my data (JSON). Up to 5 per hour."],
              [
                '"Delete my account"',
                "Dashboard → Account → Delete my account. Personal details are erased and active vouchers are cancelled. Past redemptions stay (anonymised) for café payments.",
              ],
            ],
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Reference
  {
    slug: "statuses",
    title: "Statuses explained",
    summary: "Every status of requests, vouchers, redemptions, settlements and partners, and how they change.",
    category: "Reference",
    roles: ["SUPPORT", "FINANCE", "ADMIN"],
    sections: [
      {
        id: "request",
        heading: "Request",
        blocks: [
          {
            kind: "table",
            head: ["Status", "Meaning"],
            rows: [
              ["Pending", "Waiting for support"],
              ["Approved", "Voucher issued (final)"],
              ["Rejected", "Not eligible; reason shown to customer (final)"],
            ],
          },
        ],
      },
      {
        id: "voucher",
        heading: "Voucher",
        blocks: [
          {
            kind: "table",
            head: ["Status", "Meaning"],
            rows: [
              ["Active", "Can be used at any active partner café until expiry"],
              ["Redeemed", "Used once (vouchers are single-use)"],
              ["Expired", "Validity ended without use"],
              ["Cancelled", "Void: e.g. the customer deleted their account"],
            ],
          },
        ],
      },
      {
        id: "redemption",
        heading: "Redemption",
        blocks: [
          {
            kind: "table",
            head: ["Status", "Meaning", "Next"],
            rows: [
              ["Receipt needed", "PIN accepted, no photo yet", "Customer uploads"],
              ["Receipt sent", "Photo uploaded, waiting for support", "Verify / dispute / reject"],
              ["Disputed", "On hold with a note", "Verify / reject"],
              ["Verified", "Correct; payable", "Joins a settlement (final)"],
              ["Rejected", "Won't be paid", "Final"],
            ],
          },
        ],
      },
      {
        id: "settlement",
        heading: "Settlement & partner",
        blocks: [
          {
            kind: "table",
            head: ["Status", "Meaning"],
            rows: [
              ["Draft", "Collected, waiting for a second person to approve"],
              ["Approved", "Checked; ready to transfer money"],
              ["Paid", "Money sent; reference recorded; locked forever"],
              ["Partner Active / Paused / Ended", "Whether that café's branches accept vouchers"],
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "limits",
    title: "Limits & automatic rules",
    summary: "Every time limit, attempt limit and automatic job in one table.",
    category: "Reference",
    roles: ["SUPPORT", "FINANCE", "ADMIN"],
    sections: [
      {
        id: "limits",
        heading: "Limits",
        blocks: [
          {
            kind: "table",
            head: ["What", "Limit", "Why"],
            rows: [
              ["Login code validity", "5 minutes", "Short-lived codes are useless if leaked"],
              ["Wrong tries per login code", "5", "Stops guessing"],
              ["Login codes per email/phone", "3 per 15 min", "Stops SMS spam"],
              ["Invoice submissions per network", "5 per hour", "Stops bulk fake claims"],
              ["Wrong branch PINs per voucher", "5 per 15 min, then 15 min lock", "Stops PIN guessing at the counter"],
              ["Receipt uploads per redemption", "10 per hour", "Abuse protection"],
              ["Receipt photo size", "8 MB; JPEG, PNG, HEIC", "Phone photos fit easily"],
              ["Customer stays signed in", "30 days", "Convenient at the counter"],
              ["Staff session", "12 hours", "Shared office computers"],
              ["Staff sign-in attempts", "10 per 15 min", "Stops password guessing"],
              ["Staff password length", "12+ characters", "Easy-to-remember passphrases are fine"],
              ["Success screen stays green", "10 minutes", "Cashier sees a fresh, live confirmation; old screenshots look different"],
            ],
          },
        ],
      },
      {
        id: "jobs",
        heading: "Automatic jobs (hourly)",
        blocks: [
          {
            kind: "list",
            items: [
              "Vouchers past their expiry become **Expired**.",
              "Customers get an expiry reminder by email (and SMS when enabled) **3 days before** a voucher expires (once per voucher).",
              "Every SMS is retried up to 3 times. Each attempt is logged, so failed messages can be investigated. While SMS is switched off, no SMS are sent or logged.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "glossary",
    title: "Glossary",
    summary: "Words used across the admin.",
    category: "Reference",
    roles: ["SUPPORT", "FINANCE", "ADMIN"],
    sections: [
      {
        id: "terms",
        heading: "Terms",
        blocks: [
          {
            kind: "fields",
            items: [
              {
                name: "OTP",
                why: "One-time password: the 6-digit login code customers receive.",
              },
              {
                name: "Standee",
                why: "The printed A6 card on the café counter with the branch QR code.",
              },
              {
                name: "Branch code",
                why: "Short permanent ID of a café location, inside the QR link `/r/<code>`.",
              },
              {
                name: "Branch PIN",
                why: "4-digit secret the cashier types to confirm a redemption.",
              },
              {
                name: "Ref (R-XXXXXX)",
                why: "Short redemption reference shared by the customer screen, branch SMS and admin.",
              },
              {
                name: "Face value",
                why: "What a voucher can cost at most: fixed amount, or the max discount for percent offers. Budgets add these up.",
              },
              {
                name: "Basis points",
                why: "How percentages are stored internally: 15% = 1500. You always type normal percentages.",
              },
              {
                name: "Paisa",
                why: "1/100 of a taka. All money is stored in paisa.",
              },
              {
                name: "Four-eyes rule",
                why: "Two different people must create and approve a settlement.",
              },
              {
                name: "Settlement",
                why: "One payment to one partner covering verified redemptions in a period.",
              },
            ],
          },
        ],
      },
    ],
  },
];

export const HELP_CATEGORIES = ["Start here", "Screens", "Support playbook", "Reference"] as const;

export function findHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function helpForScreen(path: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.screen === path);
}

/** Flat text of an article, for the search box. */
export function helpSearchText(a: HelpArticle): string {
  const parts: string[] = [a.title, a.summary];
  for (const s of a.sections) {
    parts.push(s.heading);
    for (const b of s.blocks) {
      if (b.kind === "p" || b.kind === "note") parts.push(b.text);
      else if (b.kind === "list" || b.kind === "steps") parts.push(...b.items);
      else if (b.kind === "fields") for (const f of b.items) parts.push(f.name, f.why, f.tip ?? "");
      else if (b.kind === "table") parts.push(...b.head, ...b.rows.flat());
      else parts.push(b.label, b.text);
    }
  }
  return parts.join(" ").replace(/[*`]/g, "").toLowerCase();
}
