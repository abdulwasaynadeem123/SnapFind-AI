import { ScreenshotItem } from "../types";

// Helper to create clean base64/SVG data URIs for self-contained, offline-ready sample screenshots
function createSampleSvgUri(title: string, category: string, lines: string[], accentColor: string): string {
  const contentLines = lines
    .map((line, idx) => `<text x="40" y="${190 + idx * 30}" fill="#94A3B8" font-size="15" font-family="system-ui, -apple-system, sans-serif">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0F172A"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1E293B"/>
        <stop offset="100%" stop-color="#0F172A"/>
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${accentColor}"/>
        <stop offset="100%" stop-color="#00FFCC"/>
      </linearGradient>
    </defs>
    <!-- Background Frame -->
    <rect width="800" height="600" fill="url(#bgGrad)" rx="24"/>
    <!-- Simulated Device Window Header -->
    <rect x="20" y="20" width="760" height="560" fill="url(#cardGrad)" rx="18" stroke="#334155" stroke-width="1.5"/>
    <circle cx="50" cy="48" r="6" fill="#EF4444"/>
    <circle cx="70" cy="48" r="6" fill="#F59E0B"/>
    <circle cx="90" cy="48" r="6" fill="#10B981"/>
    
    <!-- Top Category Badge -->
    <rect x="620" y="36" width="135" height="26" rx="13" fill="${accentColor}" fill-opacity="0.15" stroke="${accentColor}" stroke-width="1"/>
    <text x="687" y="53" fill="${accentColor}" font-size="11" font-weight="700" font-family="system-ui, sans-serif" text-anchor="middle">${category.toUpperCase()}</text>
    
    <!-- Main Header Card -->
    <rect x="40" y="80" width="720" height="70" rx="12" fill="#090E17" stroke="#1E293B" stroke-width="1"/>
    <rect x="40" y="80" width="8" height="70" rx="4" fill="url(#accentGrad)"/>
    <text x="65" y="112" fill="#F8FAFC" font-size="20" font-weight="700" font-family="system-ui, sans-serif">${title}</text>
    <text x="65" y="136" fill="#64748B" font-size="12" font-family="system-ui, sans-serif">SNAPFIND AI VERIFIED SAMPLE • OCR INDEXED</text>
    
    <!-- Divider -->
    <line x1="40" y1="170" x2="760" y2="170" stroke="#334155" stroke-width="1" stroke-dasharray="4 4"/>
    
    <!-- OCR Body Lines -->
    ${contentLines}
    
    <!-- Bottom Bar -->
    <rect x="40" y="515" width="720" height="40" rx="8" fill="#090E17" stroke="#1E293B" stroke-width="1"/>
    <circle cx="60" cy="535" r="4" fill="#FFFFFF"/>
    <text x="75" y="540" fill="#94A3B8" font-size="12" font-family="system-ui, sans-serif">Synthetic sample dataset for demonstration and automated testing</text>
    <text x="720" y="540" fill="${accentColor}" font-size="12" font-weight="600" font-family="system-ui, sans-serif" text-anchor="end">READY TO SEARCH</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_SAMPLE_SCREENSHOTS: ScreenshotItem[] = [
  {
    id: "sample-snap-passport-01",
    title: "Republic Passport Identification Page",
    category: "Passport",
    collectionName: "Travel & Identity",
    summary: "Official international passport identification page showing biographical info, document number, and nationality.",
    description: "Passport document page with machine-readable zone, issue date, expiration date, and holder name Alexandra Morgan.",
    fullText: "REPUBLIC PASSPORT\nDocument Type: P\nCountry Code: RPB\nPassport No: P98234102\nSurname: MORGAN\nGiven Names: ALEXANDRA JANE\nNationality: CITIZEN\nDate of Birth: 14 MAY 1994\nSex: F\nPlace of Birth: METROPOLIS\nDate of Issue: 21 OCT 2020\nDate of Expiry: 20 DEC 2030\nAuthority: PASSPORT OFFICE\nP<RPBMORGAN<<ALEXANDRA<JANE<<<<<<<<<<<<<<<<<\nP982341023RPB9405148F3012204<<<<<<<<<<<<<<02",
    ocr_text: "REPUBLIC PASSPORT\nDocument Type: P\nCountry Code: RPB\nPassport No: P98234102\nSurname: MORGAN\nGiven Names: ALEXANDRA JANE\nNationality: CITIZEN\nDate of Birth: 14 MAY 1994\nDate of Expiry: 20 DEC 2030",
    keyEntities: ["Alexandra Jane Morgan", "P98234102", "20 DEC 2030", "Republic Passport"],
    keywords: ["passport", "republic", "travel", "alexandra", "identity", "visa", "document", "expiry"],
    tags: ["passport", "travel", "identity", "official", "verified"],
    objects: ["document", "photo frame", "barcode", "mrz lines"],
    textDensity: "high",
    keyMetrics: ["P98234102", "2030"],
    imageUrl: createSampleSvgUri(
      "Republic Passport Identification Page",
      "Passport",
      [
        "DOCUMENT TYPE: PASSPORT (P)",
        "SURNAME: MORGAN",
        "GIVEN NAMES: ALEXANDRA JANE",
        "PASSPORT NUMBER: P98234102",
        "DATE OF BIRTH: 14 MAY 1994",
        "NATIONALITY: CITIZEN",
        "DATE OF EXPIRY: 20 DEC 2030",
        "MACHINE READABLE ZONE: P<RPBMORGAN<<ALEXANDRA<JANE<<<<<<<<<<<<<<<",
        "STATUS: VALID UNTIL DEC 2030"
      ],
      "#FFFFFF"
    ),
    thumbnailUri: "",
    fileName: "passport_alex_morgan.png",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    indexedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    processingStatus: "Completed",
    fileSizeKB: 184,
    sha256Hash: "hash_sample_passport_001",
    privacy_level: "normal",
    isSensitive: false,
    smart_category: "IDs/Documents",
  },
  {
    id: "sample-snap-bill-02",
    title: "Monthly Electric Power Utility Statement",
    category: "Electricity Bill",
    collectionName: "Utility Bills",
    summary: "Electricity utility bill statement with billing period, kilowatt consumption, and due amount.",
    description: "Metro Power & Electric statement with account number 8842-1099-23 and due amount of $148.65.",
    fullText: "METRO POWER & ELECTRIC COMPANY\nStatement Date: Oct 01, 2026\nAccount Number: 8842-1099-23\nService Address: 742 Evergreen Terrace\nBilling Period: Sep 01 - Sep 30, 2026\nTotal Energy Consumed: 842 kWh\nRate per kWh: $0.152\nEnergy Charges: $127.98\nTaxes and Municipal Fees: $20.67\nTOTAL AMOUNT DUE: $148.65\nPAYMENT DUE DATE: October 25, 2026\nPlease pay before due date to avoid late penalty fee of $15.00.",
    ocr_text: "METRO POWER & ELECTRIC COMPANY\nAccount Number: 8842-1099-23\nBilling Period: Sep 01 - Sep 30, 2026\nTotal Due Amount: $148.65\nDue Date: October 25, 2026",
    keyEntities: ["Metro Power & Electric", "8842-1099-23", "$148.65", "October 25, 2026"],
    keywords: ["electricity", "power", "bill", "utility", "due", "amount", "electric", "kwh", "meter"],
    tags: ["electricity", "bill", "utility", "power", "monthly"],
    objects: ["bill", "barcode", "table", "amount due box"],
    textDensity: "high",
    keyMetrics: ["$148.65", "842 kWh"],
    imageUrl: createSampleSvgUri(
      "Monthly Electric Power Utility Statement",
      "Electricity Bill",
      [
        "PROVIDER: METRO POWER & ELECTRIC COMPANY",
        "ACCOUNT NUMBER: 8842-1099-23",
        "BILLING PERIOD: SEP 01 - SEP 30, 2026",
        "CONSUMPTION: 842 kWh",
        "ENERGY CHARGES: $127.98",
        "TAXES & FEES: $20.67",
        "TOTAL AMOUNT DUE: $148.65",
        "DUE DATE: OCTOBER 25, 2026",
        "STATUS: PENDING PAYMENT"
      ],
      "#F59E0B"
    ),
    thumbnailUri: "",
    fileName: "electricity_bill_september.png",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    indexedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    processingStatus: "Completed",
    fileSizeKB: 142,
    sha256Hash: "hash_sample_bill_002",
    privacy_level: "normal",
    isSensitive: false,
    smart_category: "Invoices",
  },
  {
    id: "sample-snap-recipe-03",
    title: "Artisan Neapolitan Pizza Recipe",
    category: "Recipe",
    collectionName: "Food & Recipes",
    summary: "Crispy wood-fired sourdough pizza dough recipe with detailed baking instructions and ingredients.",
    description: "Step by step Neapolitan pizza recipe with San Marzano tomatoes, fresh mozzarella, and 00 flour.",
    fullText: "ARTISAN NEAPOLITAN PIZZA RECIPE\nPrep Time: 20 min | Fermentation: 24 hrs | Bake: 9 min\nINGREDIENTS FOR 4 PIZZAS:\n- 500g Tipo 00 Flour\n- 325ml Lukewarm Water (65% hydration)\n- 10g Fine Sea Salt\n- 3g Active Dry Yeast\n- 200g San Marzano Crushed Tomatoes\n- 250g Fresh Mozzarella fior di latte\n- Fresh Basil Leaves & Extra Virgin Olive Oil\nDIRECTIONS:\n1. Dissolve yeast in warm water, knead in flour and salt for 10 minutes.\n2. Bulk ferment at room temperature for 2 hours, then cold retard 24 hours.\n3. Stretch dough gently, top with tomatoes and torn mozzarella.\n4. Bake at 500°F (260°C) on a preheated pizza stone for 8 to 10 minutes.",
    ocr_text: "ARTISAN NEAPOLITAN PIZZA RECIPE\nIngredients: 500g Tipo 00 Flour, 325ml Lukewarm Water, 10g Sea Salt, 3g Active Dry Yeast\nToppings: San Marzano Tomatoes, Fresh Mozzarella, Basil, Olive Oil\nBake at 500°F (260°C) for 8-10 minutes.",
    keyEntities: ["500g Tipo 00 Flour", "San Marzano Tomatoes", "Fresh Mozzarella", "500°F (260°C)"],
    keywords: ["pizza", "recipe", "ingredients", "flour", "mozzarella", "baking", "food", "dinner", "cooking"],
    tags: ["recipe", "pizza", "food", "cooking", "italian"],
    objects: ["recipe card", "food instructions", "list"],
    textDensity: "medium",
    keyMetrics: ["500g", "500°F", "24 hrs"],
    imageUrl: createSampleSvgUri(
      "Artisan Neapolitan Pizza Recipe",
      "Recipe",
      [
        "RECIPE: HOMEMADE NEAPOLITAN PIZZA CRUST",
        "INGREDIENTS: 500g Tipo 00 Flour, 325ml Water, 10g Salt, 3g Yeast",
        "FERMENTATION: 24 Hours Cold Ferment",
        "TOPPINGS: San Marzano Crushed Tomatoes & Fresh Mozzarella",
        "HERBS: Fresh Garden Basil & Extra Virgin Olive Oil",
        "OVEN TEMP: Preheated 500°F (260°C) with Pizza Stone",
        "BAKE TIME: 8 - 10 Minutes until Crust Blistered",
        "RATING: 4.9 / 5 Stars"
      ],
      "#10B981"
    ),
    thumbnailUri: "",
    fileName: "pizza_dough_recipe.png",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    indexedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    processingStatus: "Completed",
    fileSizeKB: 168,
    sha256Hash: "hash_sample_recipe_003",
    privacy_level: "normal",
    isSensitive: false,
    smart_category: "Personal",
  },
  {
    id: "sample-snap-travel-04",
    title: "SkyWings International Flight Boarding Pass",
    category: "Ticket & Travel",
    collectionName: "Travel & Identity",
    summary: "Electronic airline boarding pass for flight SW-442 from San Francisco to Tokyo Haneda.",
    description: "Flight confirmation pass with gate G92, seat 14A, boarding time 10:15 AM, and passenger name Alex Morgan.",
    fullText: "SKYWINGS INTERNATIONAL AIRLINES\nELECTRONIC BOARDING PASS\nPASSENGER: MORGAN / ALEX\nFLIGHT: SW-442 | CLASS: ECONOMY PREMIUM\nFROM: SFO - SAN FRANCISCO INTL\nTO: HND - TOKYO HANEDA AIRPORT\nDATE: 12 NOV 2026\nDEPARTURE TIME: 11:00 AM\nBOARDING TIME: 10:15 AM\nGATE: G92 | SEAT: 14A | GROUP: 2\nETICKET: 016-8921004412\nBOOKING REF: WX9K2P",
    ocr_text: "SKYWINGS AIRLINES\nPASSENGER: MORGAN / ALEX\nFLIGHT: SW-442\nFROM: SFO TO: HND\nGATE: G92 SEAT: 14A\nDATE: 12 NOV 2026\nBOARDING TIME: 10:15 AM",
    keyEntities: ["SkyWings Airlines", "SW-442", "SFO to HND", "Gate G92", "Seat 14A", "Alex Morgan"],
    keywords: ["flight", "boarding pass", "ticket", "travel", "airline", "san francisco", "tokyo", "skywings", "seat 14a"],
    tags: ["flight", "travel", "ticket", "boardingpass", "airline"],
    objects: ["boarding pass", "barcode", "seat number badge"],
    textDensity: "high",
    keyMetrics: ["SW-442", "14A", "G92"],
    imageUrl: createSampleSvgUri(
      "SkyWings Flight Boarding Pass",
      "Ticket & Travel",
      [
        "AIRLINE: SKYWINGS INTERNATIONAL",
        "PASSENGER: ALEX MORGAN",
        "FLIGHT: SW-442 (NONSTOP)",
        "ROUTE: SFO (SAN FRANCISCO) -> HND (TOKYO)",
        "DEPARTURE DATE: 12 NOV 2026",
        "BOARDING TIME: 10:15 AM (GATE CLOSES 10:45 AM)",
        "GATE: G92 | SEAT: 14A (WINDOW)",
        "BOOKING REFERENCE: WX9K2P"
      ],
      "#6366F1"
    ),
    thumbnailUri: "",
    fileName: "boarding_pass_tokyo.png",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    indexedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    processingStatus: "Completed",
    fileSizeKB: 156,
    sha256Hash: "hash_sample_travel_004",
    privacy_level: "normal",
    isSensitive: false,
    smart_category: "Travel",
  },
  {
    id: "sample-snap-receipt-05",
    title: "HomeCraft Hardware Store Purchase Receipt",
    category: "Receipt & Invoice",
    collectionName: "Shopping Receipts",
    summary: "Itemized retail purchase receipt for tools, drill kit, and hardware supplies with subtotal and tax.",
    description: "Store receipt with order number #HC-99214, total of $112.30, paid by Visa card ending in 4092.",
    fullText: "HOMECRAFT HARDWARE & BUILDING SUPPLIES\nStore #104 | 450 Market Street\nDate: 10/18/2026  Time: 14:32:10\nCashier: Marcus T. | Register: 04\nORDER #: HC-99214\nITEMS PURCHASED:\n1x 20V Cordless Power Drill Kit: $89.00\n1x Precision Steel Screw Set (200 pc): $14.50\nSubtotal: $103.50\nSales Tax (8.5%): $8.80\nTOTAL AMOUNT: $112.30\nPayment Method: VISA ending in 4092\nAuth Code: 098412\nReturn policy: 30 days with original receipt.",
    ocr_text: "HOMECRAFT HARDWARE STORE\nOrder: #HC-99214\n1x 20V Cordless Drill: $89.00\n1x Steel Screw Set: $14.50\nSubtotal: $103.50 Tax: $8.80 Total: $112.30\nPayment: VISA ****4092",
    keyEntities: ["HomeCraft Hardware", "#HC-99214", "$112.30", "20V Cordless Drill", "VISA 4092"],
    keywords: ["receipt", "invoice", "hardware", "drill", "tools", "total", "payment", "visa", "homecraft"],
    tags: ["receipt", "invoice", "shopping", "tools", "expense"],
    objects: ["receipt paper", "barcode", "line items"],
    textDensity: "high",
    keyMetrics: ["$112.30", "Order #HC-99214"],
    imageUrl: createSampleSvgUri(
      "HomeCraft Hardware Store Receipt",
      "Receipt & Invoice",
      [
        "STORE: HOMECRAFT HARDWARE & BUILDING SUPPLIES",
        "DATE: 10/18/2026 14:32 | REGISTER: 04",
        "ORDER NUMBER: #HC-99214",
        "ITEM 1: 20V CORDLESS POWER DRILL KIT - $89.00",
        "ITEM 2: PRECISION STEEL SCREW SET (200 PC) - $14.50",
        "SUBTOTAL: $103.50",
        "SALES TAX (8.5%): $8.80",
        "TOTAL PAID: $112.30 (VISA ****4092)"
      ],
      "#EC4899"
    ),
    thumbnailUri: "",
    fileName: "hardware_store_receipt.png",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    indexedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    processingStatus: "Completed",
    fileSizeKB: 138,
    sha256Hash: "hash_sample_receipt_005",
    privacy_level: "normal",
    isSensitive: false,
    smart_category: "Receipts",
  },
  {
    id: "sample-snap-qrcode-06",
    title: "Digital Instant Scan to Pay QR Code",
    category: "QR Code",
    collectionName: "Digital Payments",
    summary: "Digital payment scan card with high-resolution payment QR code and merchant details.",
    description: "Scan to pay code for payments@snapfind.ai supporting Apple Pay, Google Pay, and UPI transfers.",
    fullText: "INSTANT SCAN TO PAY\nMerchant: SnapFind Technologies Inc.\nPayment ID: payments@snapfind.ai\nAccepted Methods: Apple Pay, Google Pay, Visa, Mastercard, UPI\nScan with camera or banking app to transfer funds securely.\nInstant verification & zero transaction fees.",
    ocr_text: "INSTANT SCAN TO PAY\nRecipient: SnapFind Technologies\nPayment ID: payments@snapfind.ai\nAccepted: Apple Pay, Google Pay, Visa, Mastercard\nScan with camera or banking app.",
    keyEntities: ["SnapFind Technologies", "payments@snapfind.ai", "Scan to Pay"],
    keywords: ["qr code", "scan to pay", "payments", "digital", "instant", "apple pay", "google pay", "snapfind"],
    tags: ["qrcode", "payment", "scan", "fintech", "instant"],
    objects: ["qr code graphic", "payment icons", "scan target"],
    textDensity: "medium",
    keyMetrics: ["payments@snapfind.ai"],
    hasQrCode: true,
    has_qr_code: true,
    qrCodeData: "https://snapfind.ai.studio/pay?to=snapfind&ref=demo",
    qr_code_data: "https://snapfind.ai.studio/pay?to=snapfind&ref=demo",
    qrCodeType: "URL",
    qr_code_type: "URL",
    imageUrl: createSampleSvgUri(
      "Digital Instant Scan to Pay QR Code",
      "QR Code",
      [
        "MERCHANT: SNAPFIND TECHNOLOGIES INC.",
        "PAYMENT IDENTIFIER: payments@snapfind.ai",
        "SUPPORTED: APPLE PAY, GOOGLE PAY, VISA, MASTERCARD",
        "QR DATA: https://snapfind.ai.studio/pay?to=snapfind",
        "ACTION: SCAN WITH CAMERA OR MOBILE BANKING APP",
        "SECURITY: 256-BIT ENCRYPTED PEER-TO-PEER",
        "STATUS: ACTIVE AND READY TO RECEIVE TRANSFERS"
      ],
      "#14B8A6"
    ),
    thumbnailUri: "",
    fileName: "scan_to_pay_qr.png",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    indexedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    processingStatus: "Completed",
    fileSizeKB: 148,
    sha256Hash: "hash_sample_qrcode_006",
    privacy_level: "normal",
    isSensitive: false,
    smart_category: "Payments",
  },
];
