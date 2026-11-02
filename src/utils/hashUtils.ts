/**
 * Utility to compute SHA-256 hex digest for images (base64 string, File, Blob, or ArrayBuffer)
 */
export async function computeImageSha256(
  input: string | File | Blob | ArrayBuffer
): Promise<string> {
  try {
    let arrayBuffer: ArrayBuffer;

    if (input instanceof ArrayBuffer) {
      arrayBuffer = input;
    } else if (typeof File !== "undefined" && input instanceof File) {
      arrayBuffer = await input.arrayBuffer();
    } else if (typeof Blob !== "undefined" && input instanceof Blob) {
      arrayBuffer = await input.arrayBuffer();
    } else if (typeof input === "string") {
      if (input.startsWith("data:")) {
        // Extract base64 payload
        const commaIdx = input.indexOf(",");
        const base64Str = commaIdx !== -1 ? input.slice(commaIdx + 1) : input;
        const binaryStr = atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("blob:")) {
        const response = await fetch(input);
        const blob = await response.blob();
        arrayBuffer = await blob.arrayBuffer();
      } else {
        // Plain string fallback
        const encoder = new TextEncoder();
        arrayBuffer = encoder.encode(input).buffer;
      }
    } else {
      throw new Error("Unsupported input type for SHA-256 hashing");
    }

    const digestBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(digestBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  } catch (err) {
    console.warn("[hashUtils] SHA-256 computation warning:", err);
    // Fallback pseudo-hash based on string representation
    const str = typeof input === "string" ? input : (input as any).name || String(Date.now());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, "0");
  }
}

/**
 * Compute 64-bit difference perceptual hash (dHash) for visual duplicate detection.
 * Works even when resolution, compression, or format changes.
 */
export async function computePerceptualHash(
  input: string | File | Blob
): Promise<string> {
  if (typeof window === "undefined") {
    return "0000000000000000";
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          // 9 wide by 8 high canvas for 64 difference bits
          const canvas = document.createElement("canvas");
          canvas.width = 9;
          canvas.height = 8;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            resolve("0000000000000000");
            return;
          }

          ctx.drawImage(img, 0, 0, 9, 8);
          const imgData = ctx.getImageData(0, 0, 9, 8).data;

          // Compute grayscale luminance values
          const grays: number[][] = [];
          for (let y = 0; y < 8; y++) {
            const row: number[] = [];
            for (let x = 0; x < 9; x++) {
              const idx = (y * 9 + x) * 4;
              const r = imgData[idx];
              const g = imgData[idx + 1];
              const b = imgData[idx + 2];
              // Standard perceptual luminance formula
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              row.push(lum);
            }
            grays.push(row);
          }

          // Compute horizontal gradient differences (64 bits total)
          let bitString = "";
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              bitString += grays[y][x] < grays[y][x + 1] ? "1" : "0";
            }
          }

          // Convert 64 bits to 16-hex char string
          let hexString = "";
          for (let i = 0; i < 64; i += 4) {
            const nibble = bitString.substring(i, i + 4);
            hexString += parseInt(nibble, 2).toString(16);
          }

          resolve(hexString.padStart(16, "0"));
        } catch (e) {
          console.warn("[hashUtils] Canvas pHash computation warning:", e);
          resolve("0000000000000000");
        }
      };

      img.onerror = () => {
        resolve("0000000000000000");
      };

      if (typeof input === "string") {
        img.src = input;
      } else {
        img.src = URL.createObjectURL(input);
      }
    } catch (err) {
      console.warn("[hashUtils] computePerceptualHash error:", err);
      resolve("0000000000000000");
    }
  });
}

/**
 * Calculate Hamming distance between two hex hashes (0 to 64)
 */
export function calculateHammingDistance(hex1: string, hex2: string): number {
  if (!hex1 || !hex2 || hex1.length !== hex2.length) return 64;
  let dist = 0;
  for (let i = 0; i < hex1.length; i++) {
    const val1 = parseInt(hex1[i], 16);
    const val2 = parseInt(hex2[i], 16);
    if (isNaN(val1) || isNaN(val2)) continue;
    let xor = val1 ^ val2;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/**
 * Return visual similarity score from 0.0 to 1.0 based on perceptual hash
 */
export function calculatePerceptualSimilarity(hex1?: string, hex2?: string): number {
  if (!hex1 || !hex2 || hex1 === "0000000000000000" || hex2 === "0000000000000000") return 0;
  if (hex1.toLowerCase() === hex2.toLowerCase()) return 1.0;
  const dist = calculateHammingDistance(hex1, hex2);
  return Math.max(0, 1 - dist / 64);
}

/**
 * Returns true if two images are visually identical or compressed variants
 * (threshold: distance <= 6 out of 64 bits, ~91% visual similarity)
 */
export function isPerceptualDuplicate(hex1?: string, hex2?: string, maxDistance: number = 6): boolean {
  if (!hex1 || !hex2 || hex1 === "0000000000000000" || hex2 === "0000000000000000") return false;
  if (hex1.toLowerCase() === hex2.toLowerCase()) return true;
  const dist = calculateHammingDistance(hex1, hex2);
  return dist <= maxDistance;
}
