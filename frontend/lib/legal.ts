/**
 * Mycarwash.ph vendor Terms of Service and Privacy Policy — DRAFT FOR LEGAL REVIEW.
 * Adapted for car wash shop owners and staff from River Mobile's legal docs
 * (river-mobile-ui, src/data/legalDocs.ts). Entity and contact details are
 * reused from there; nothing else is invented. Items in [brackets] are
 * placeholders to confirm before final publication.
 */

export type LegalBlock = string | { list: string[] };
export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };
export type LegalDoc = {
  slug: "terms" | "privacy";
  title: string;
  effective: string;
  intro: string[];
  sections: LegalSection[];
};

export const LEGAL_ENTITY = {
  company: "River Technology Inc.",
  brand: "River Apps",
  app: "Mycarwash.ph",
  marketplace: "River Mobile",
  founder: "Jimboy Regalado",
  address: "BF Homes, 410 El Grande Ave, Parañaque, 1720 Metro Manila",
  legalEmail: "legal@smartrefill.io",
  privacyEmail: "privacy@smartrefill.io",
} as const;

export const LEGAL_DRAFT_NOTICE = "Draft for legal review — not yet final.";
export const LEGAL_EFFECTIVE = "Effective: October 14, 2026";

const E = LEGAL_ENTITY;

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  effective: LEGAL_EFFECTIVE,
  intro: [
    `Welcome to ${E.app}, an app of ${E.brand} founded by ${E.founder} and operated by ${E.company} (“River,” “we,” “our,” or “us”).`,
    `These Terms of Service (“Terms”) apply to car wash shop owners (“Vendor,” “you”) and the staff they invite who use ${E.app} to run their shop and to receive and verify ${E.marketplace} customers (the “Services”). By creating a shop account, inviting staff or using the Services, you agree to these Terms on behalf of yourself and your business. If you do not agree, please do not use the Services.`,
  ],
  sections: [
    {
      id: "about",
      title: "1. What Mycarwash.ph is",
      blocks: [
        `${E.app} is a shop management web app for car washes: bookings, queue, sales, customers, staff and Scan. It is a standalone app with its own systems, separate from ${E.marketplace}, our customer marketplace.`,
        `${E.app} connects to ${E.marketplace} only through our API, to share your shop profile, address, map location, shop photos, services, and bookings and scans. You run your own business and are independent of River.`,
      ],
    },
    {
      id: "roles",
      title: "2. Your responsibilities vs River’s",
      blocks: [
        { list: [
          "<b>You are responsible</b> for your car wash services: quality and vehicle care, prices, staff, schedules, business permits, taxes, receipts, insurance and compliance with applicable laws.",
          `<b>River is responsible</b> for the app: providing the Services, showing your listing in ${E.marketplace} as you provide it, passing bookings to you, and handling support in good faith.`,
          "You are responsible for any damage, loss or complaint arising from services you perform. River is not a party to the service contract between you and your customer.",
        ] },
      ],
    },
    {
      id: "accounts",
      title: "3. Shop accounts and staff",
      blocks: [
        { list: [
          "You must be at least 18 and authorised to act for the business you register.",
          "You sign in with your Philippine mobile number (one-time SMS code) or your Google account. Keep your phone and Google account secure; activity on your shop account is your responsibility.",
          "You may invite staff and assign them roles. You decide who has access, must remove access when someone leaves, and are responsible for what your staff do in the app.",
          "Give accurate shop details. Do not register a shop you do not own or operate, or impersonate another business.",
        ] },
      ],
    },
    {
      id: "listing",
      title: "4. Your public listing in River Mobile",
      blocks: [
        { list: [
          `Your shop name, address, map location, shop photos, services, prices and hours are shown publicly in ${E.marketplace} and may appear on maps and search.`,
          "Only upload photos you own or have permission to use, and do not include faces, plate numbers or personal data of customers without their consent.",
          "Keep your listing accurate and up to date. We may edit formatting, hide or remove listings that are misleading, unsafe or break these Terms.",
          `You give River a non-exclusive, royalty-free licence to host, display and share your listing content in the Services and ${E.marketplace}, and to use it to promote ${E.brand}, while your shop is listed.`,
        ] },
      ],
    },
    {
      id: "bookings",
      title: "5. River Mobile bookings and Scan",
      blocks: [
        { list: [
          `${E.marketplace} customers can book or visit your shop. Accept or decline bookings promptly and honour the bookings you accept.`,
          "Use Scan to verify River Mobile customers by their member QR code. Scan only codes customers show you, only to verify and serve them, and do not copy or store codes elsewhere.",
          "If you cannot serve a booking, cancel it in the app as early as possible so the customer can be notified and refunded where applicable.",
          "Customer complaints should be handled first in the app. We may contact you to help resolve disputes and refunds.",
        ] },
      ],
    },
    {
      id: "plans",
      title: "6. Plans, fees and payments",
      blocks: [
        { list: [
          `<b>Partner (free):</b> for receiving and verifying ${E.marketplace} customers via Scan, with a public listing.`,
          "<b>Paid plans:</b> add shop management tools such as queue, sales, customers, staff and growth features. Paid access is offered as a monthly subscription (currently ₱950/month) or a one-time payment (currently ₱10,000). Current prices, what is included and billing terms are shown in the app before you pay.",
          "Monthly plans renew automatically until you cancel; cancellation takes effect at the end of the current period. Fees paid are not refundable except where the law requires it or we state otherwise.",
          "Online payments are processed by our payment processor; River does not store your full card number.",
          "We may change plans or prices with notice in the app before the change applies to you.",
        ] },
      ],
    },
    {
      id: "customers",
      title: "7. Your customer records (walk-in / POS)",
      blocks: [
        `When you record your own walk-in or POS customers, staff, vehicles or sales in ${E.app}, you are the personal information controller for that data and River processes it on your behalf as your personal information processor. You must have a lawful basis to collect it, tell your customers how you use it, and handle their requests under the Data Privacy Act of 2012. See the Privacy Policy for details.`,
      ],
    },
    {
      id: "use",
      title: "8. Acceptable use",
      blocks: [
        { list: [
          "Use the Services only for lawful business purposes of your car wash.",
          "Do not create fake bookings, scans, reviews or customers, or manipulate ratings or rewards.",
          `Do not contact ${E.marketplace} customers for purposes unrelated to their booking without their consent, or use their data outside the Services.`,
          "Do not misuse, copy, reverse-engineer, scrape or interfere with the Services or the API, or try to get around security or payments.",
        ] },
      ],
    },
    {
      id: "availability",
      title: "9. Service availability and maps",
      blocks: [
        "We aim for high availability but cannot guarantee uninterrupted service. Keep your own records of essential business data. Maps and locations rely on third-party map data (including OpenStreetMap) and may not be exact.",
      ],
    },
    {
      id: "ip",
      title: "10. Intellectual property",
      blocks: [
        `River owns the Services, including software, the ${E.brand}, ${E.app} and ${E.marketplace} names, logos and designs. Your shop name, logo and photos remain yours.`,
      ],
    },
    {
      id: "termination",
      title: "11. Suspension and closing your shop",
      blocks: [
        `We may suspend or remove shops or staff accounts that break these Terms, commit fraud or put customers at risk. You can stop using the Services at any time; contact us to close your shop account. Your listing will then be removed from ${E.marketplace}, and we handle remaining data as described in the Privacy Policy.`,
      ],
    },
    {
      id: "liability",
      title: "12. Limitation of liability",
      blocks: [
        "To the maximum extent permitted by law: River is not liable for indirect or consequential damages, lost profits or data, or for the acts of customers; and our total liability for any claim is limited to the fees you paid to River in the 3 months before the claim. Nothing in these Terms excludes liability that cannot be excluded under Philippine law.",
      ],
    },
    {
      id: "indemnity",
      title: "13. Indemnification",
      blocks: [
        "You agree to indemnify River for claims arising from your services, your staff, your listing content, your handling of customer data, or your violation of these Terms or the law.",
      ],
    },
    {
      id: "changes",
      title: "14. Changes to these Terms",
      blocks: [
        "We may update these Terms. We will show the new effective date and, for material changes, notify you in the app before they apply. Continuing to use the Services after that means you accept the updated Terms.",
      ],
    },
    {
      id: "law",
      title: "15. Governing law and disputes",
      blocks: [
        "These Terms are governed by the laws of the Philippines. We will first try to resolve any dispute informally through support. Unresolved disputes are subject to the courts of Parañaque City.",
      ],
    },
    {
      id: "contact",
      title: "16. Contact us",
      blocks: [
        { list: [
          `Email: ${E.legalEmail}`,
          `Company: ${E.company}`,
          `Business address: ${E.address}`,
          "SEC registration no.: [to be provided]",
        ] },
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  effective: LEGAL_EFFECTIVE,
  intro: [
    `${E.company} (“River,” “we”) operates ${E.app}, an app of ${E.brand} for car wash shop owners and their staff. We protect personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the issuances of the National Privacy Commission (NPC).`,
    `For shop owner and staff accounts, we are the personal information controller. For customer records you add yourself (walk-in / POS customers), you are the controller and we act as your processor (see Section 5).`,
  ],
  sections: [
    {
      id: "collect",
      title: "1. Information we collect",
      blocks: [
        { list: [
          "<b>Account data:</b> name, mobile number, email, and your Google account name and email if you sign in with Google; staff names, roles and invites.",
          "<b>Sign-in data:</b> we use Firebase Authentication by Google for phone (SMS code) and Google sign-in. reCAPTCHA by Google may check that sign-in is not automated.",
          "<b>Shop data:</b> shop name, address, map location, photos, services, prices, hours and plan.",
          `<b>Bookings and scans:</b> ${E.marketplace} bookings sent to your shop and the scans your staff make, with time and staff member.`,
          "<b>Business records you add:</b> queue, sales, walk-in customers and vehicles.",
          "<b>Payments:</b> plan, amount, status and reference. Card and e-wallet details are collected by our payment processor, not stored by River.",
          "<b>Device and usage data:</b> app version, device and browser type, IP address, crash logs and in-app activity.",
        ] },
      ],
    },
    {
      id: "use",
      title: "2. How we use your information",
      blocks: [
        { list: [
          "To create and secure shop and staff accounts and verify mobile numbers.",
          `To publish your shop in ${E.marketplace} and send you bookings and verify customers via Scan.`,
          "To provide the shop tools on your plan and process plan payments.",
          "To send service messages (OTP codes, booking alerts) by SMS, push or email.",
          "To provide support, prevent fraud and keep the platform safe.",
          "To improve the Services through aggregated analytics.",
        ] },
        "Our lawful bases are the performance of our contract with you, your consent, our legitimate interests (security, fraud prevention, improving the Services) and legal obligations.",
      ],
    },
    {
      id: "public",
      title: "3. What is public",
      blocks: [
        `Your shop name, address, map location, shop photos, services, prices and hours are shown publicly in ${E.marketplace}. Do not put personal data you do not want public (such as a personal mobile number or photos of people) in your listing.`,
      ],
    },
    {
      id: "share",
      title: "4. Sharing with River Mobile and others",
      blocks: [
        "We do not sell personal data. We share it only as needed:",
        { list: [
          `<b>${E.marketplace}:</b> ${E.app} has its own separate Firebase project. It shares data with ${E.marketplace} only through our API, and only your shop profile, address, map location, shop photos, services, and bookings and scans.`,
          `<b>${E.marketplace} customers:</b> receive your public listing and booking status. You receive the customer details needed to serve their booking.`,
          "<b>Service providers:</b> Google Firebase and Google Cloud (hosting, database, sign-in), our payment processor, SMS providers, map services and analytics and crash reporting tools.",
          "<b>Authorities</b> when required by law or to protect rights and safety.",
        ] },
        "Some service providers store data outside the Philippines. We use contracts and safeguards as required by the Data Privacy Act.",
      ],
    },
    {
      id: "processor",
      title: "5. Your customers’ and staff data: you are the controller",
      blocks: [
        { list: [
          "For walk-in / POS customer records, vehicles, sales and staff details you enter, you are the personal information controller and River is your personal information processor.",
          "We process that data only to provide the Services to you and on your instructions, keep it confidential, protect it with the security measures below, and do not use it for our own marketing or share it with River Mobile.",
          "You are responsible for having a lawful basis, giving privacy notices to your customers and staff, and answering their requests. We will help you respond where reasonable.",
          "We will notify you without undue delay of a personal data breach affecting that data.",
        ] },
      ],
    },
    {
      id: "retention",
      title: "6. How long we keep data",
      blocks: [
        { list: [
          "Account and shop data: while your shop account is active.",
          "Bookings, scans, sales and payment records: 10 years, as required for tax and accounting records under the National Internal Revenue Code (NIRC), then deleted or anonymised.",
          "After you close your shop account we remove your public listing and delete or anonymise personal data within 30 days, except records we must keep by law. You can request an export of your business records before closing.",
        ] },
      ],
    },
    {
      id: "security",
      title: "7. Security",
      blocks: [
        { list: [
          "Encryption of data in transit and at rest.",
          "Access rules so only your shop and the staff you invite can read your shop data, with role-based access.",
          "Monitoring and regular backups.",
          "We will notify you and the NPC of a personal data breach as required by law (within 72 hours of knowledge where applicable).",
        ] },
      ],
    },
    {
      id: "rights",
      title: "8. Your rights under the Data Privacy Act",
      blocks: [
        "As a data subject you have the right to be informed; to access your data; to object; to correct inaccurate data; to erasure or blocking; to data portability; to withdraw consent; to damages; and to file a complaint with the National Privacy Commission (privacy.gov.ph).",
        "You can edit your shop and account details in Settings. For other requests, contact our Data Protection Officer. We respond within 15 days. Your own customers should contact your shop directly.",
      ],
    },
    {
      id: "changes",
      title: "9. Changes to this policy",
      blocks: [
        "We may update this policy. We will show the new effective date and tell you in the app about material changes.",
      ],
    },
    {
      id: "dpo",
      title: "10. Contact our Data Protection Officer",
      blocks: [
        { list: [
          `Email: ${E.privacyEmail}`,
          `Data Protection Officer: ${E.founder}`,
          `Company: ${E.company}`,
          `Address: ${E.address}`,
          "NPC registration no.: [to be provided]",
        ] },
      ],
    },
  ],
};
