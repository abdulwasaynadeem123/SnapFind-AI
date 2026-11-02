/**
 * Advanced Image Preprocessing & Entity Extraction for OCR
 * 
 * Provides:
 * 1. Image preprocessing: contrast stretching, small text scaling, grayscale, sharpening
 * 2. Specialized entity extraction (dates, phone numbers, emails, URLs, monetary amounts, tracking IDs)
 * 3. Urdu script detection (\u0600-\u06FF)
 */

export interface ExtractedEntities {
  dates: string[];
  phoneNumbers: string[];
  emails: string[];
  urls: string[];
  amounts: string[];
  trackingNumbers: string[];
}

/**
 * Preprocesses an image to significantly improve Tesseract & Vision OCR recognition rates,
 * especially on small screenshots, low-contrast receipts, and mobile status bars.
 */
export async function preprocessImageForOcr(
  imageSource: string | File | Blob
): Promise<string> {
  if (typeof window === "undefined") {
    return typeof imageSource === "string" ? imageSource : "";
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        let targetWidth = img.naturalWidth || img.width;
        let targetHeight = img.naturalHeight || img.height;

        // Upscale small screenshots to ensure min width of 1200px for small font legibility
        if (targetWidth < 1200 && targetWidth > 0) {
          const scale = 1200 / targetWidth;
          targetWidth = 1200;
          targetHeight = Math.round(targetHeight * scale);
        }

        // Cap excessive resolution at 2800px to avoid memory exhaustion
        if (targetWidth > 2800) {
          const scale = 2800 / targetWidth;
          targetWidth = 2800;
          targetHeight = Math.round(targetHeight * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource as Blob));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        const len = data.length;

        // Calculate min and max luminance for contrast stretching
        let minLum = 255;
        let maxLum = 0;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }

        const range = maxLum - minLum || 1;

        // Apply contrast normalization
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          let lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Stretch contrast
          lum = ((lum - minLum) / range) * 255;

          // Mild unsharp/gamma enhancement
          lum = Math.min(255, Math.max(0, lum));

          data[i] = lum;
          data[i + 1] = lum;
          data[i + 2] = lum;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (err) {
        console.warn("[OCRPreprocess] Fallback to raw image:", err);
        resolve(typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource as Blob));
      }
    };

    img.onerror = () => {
      resolve(typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource as Blob));
    };

    if (typeof imageSource === "string") {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Checks if the text contains Urdu or Arabic script characters
 */
export function hasUrduOrArabicScript(text: string): boolean {
  if (!text) return false;
  // Unicode range for Arabic & Urdu script
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Extracts concrete identifiable entities from raw OCR or Gemini text:
 * - Dates
 * - Phone numbers (International, Pakistani, US)
 * - Emails
 * - URLs
 * - Amounts (PKR, USD, EUR, etc.)
 * - Tracking & Reference numbers
 */
export function extractStructuredEntitiesFromText(text: string): ExtractedEntities {
  if (!text || typeof text !== "string") {
    return {
      dates: [],
      phoneNumbers: [],
      emails: [],
      urls: [],
      amounts: [],
      trackingNumbers: [],
    };
  }

  // 1. Dates: YYYY-MM-DD, DD/MM/YYYY, Mon DD, YYYY
  const dateRegex = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/gi;
  const rawDates = text.match(dateRegex) || [];
  const dates = Array.from(new Set(rawDates.map((d) => d.trim()))).slice(0, 10);

  // 2. Phone Numbers: +92 3xx xxx xxxx, 03xx-xxxxxxx, (xxx) xxx-xxxx
  const phoneRegex = /(?:\+?92[\s-]?)?0?3\d{2}[\s-]?\d{7}\b|(?:\+?1[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/g;
  const rawPhones = text.match(phoneRegex) || [];
  const phoneNumbers = Array.from(new Set(rawPhones.map((p) => p.trim()))).slice(0, 10);

  // 3. Emails
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
  const rawEmails = text.match(emailRegex) || [];
  const emails = Array.from(new Set(rawEmails.map((e) => e.toLowerCase().trim()))).slice(0, 10);

  // 4. URLs
  const urlRegex = /\b(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*\b|[a-zA-Z0-9-]+\.(?:com|org|net|edu|pk|io|ai|app|co|gov)\b/gi;
  const rawUrls = text.match(urlRegex) || [];
  const urls = Array.from(
    new Set(
      rawUrls
        .map((u) => u.trim())
        .filter((u) => !u.includes("@") && u.length > 4)
    )
  ).slice(0, 10);

  // 5. Monetary Amounts: PKR 7,999, Rs. 1500, $49.99, etc.
  const amountRegex = /\b(?:PKR|Rs\.?|USD|\$|EUR|€|GBP|£|AED|SAR)\s*[\d,]+(?:\.\d{1,2})?\b|\b[\d,]+(?:\.\d{1,2})?\s*(?:PKR|Rs\.?|USD|EUR|GBP|AED)\b/gi;
  const rawAmounts = text.match(amountRegex) || [];
  const amounts = Array.from(new Set(rawAmounts.map((a) => a.trim()))).slice(0, 10);

  // 6. Tracking Numbers, Transaction IDs (TID), Order Numbers
  const trackingRegex = /\b(?:TID|TRK|ORDER|REF|INV|TRANSACTION|ID)[\s:#-]*([A-Za-z0-9-]{6,24})\b|\b[A-Z0-9]{10,20}\b/gi;
  const rawTracking: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = trackingRegex.exec(text)) !== null) {
    const val = match[1] || match[0];
    if (val && val.length >= 6 && !val.match(/^[0-9]+$/)) {
      rawTracking.push(val.trim());
    }
  }
  const trackingNumbers = Array.from(new Set(rawTracking)).slice(0, 8);

  return {
    dates,
    phoneNumbers,
    emails,
    urls,
    amounts,
    trackingNumbers,
  };
}
