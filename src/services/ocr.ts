import { createWorker } from "tesseract.js";
import {
  preprocessImageForOcr,
  extractStructuredEntitiesFromText,
  ExtractedEntities,
  hasUrduOrArabicScript,
} from "../utils/ocrPreprocessing";

export interface OCRResult {
  success: boolean;
  text: string;
  ocrText?: string;
  confidence: number;
  isLowConfidence: boolean;
  lines: string[];
  words: string[];
  provider: string;
  entities: ExtractedEntities;
  hasUrduOrArabic?: boolean;
}

async function toBase64String(input: string | File | Blob): Promise<string> {
  if (typeof input === "string") {
    return input;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(input);
  });
}

export interface OCROptions {
  lang?: string;
  skipPreprocessing?: boolean;
}

/**
 * Singleton OCR Worker Manager
 * Reuses a single Tesseract worker across image scans where supported by browser sandbox,
 * and gracefully falls back to Server Vision OCR if client web workers are restricted.
 */
class OCRWorkerManager {
  private workerPromise: Promise<any> | null = null;
  private workerInstance: any = null;
  private isWorkerSupported: boolean = true;
  private initAttempted: boolean = false;
  private currentLanguage: string = "eng";
  private currentProgressCallback: ((progress: number, status: string) => void) | null = null;
  private queue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;

  public isSupported(): boolean {
    return this.isWorkerSupported;
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Set or switch OCR language (default 'eng', supports 'urd' for Urdu)
   */
  public async setLanguage(lang: string = "eng"): Promise<void> {
    const targetLang = lang.trim().toLowerCase() || "eng";
    if (this.currentLanguage === targetLang) return;

    this.currentLanguage = targetLang;
    if (this.workerInstance) {
      try {
        await this.workerInstance.loadLanguage(targetLang);
        await this.workerInstance.initialize(targetLang);
      } catch (err) {
        console.warn(`[OCRWorkerManager] Language switch to ${targetLang} notice:`, err);
        await this.terminate();
      }
    }
  }

  /**
   * Get or initialize the persistent Tesseract worker singleton
   */
  public async getWorker(targetLang: string = this.currentLanguage): Promise<any | null> {
    if (this.workerInstance) {
      if (this.currentLanguage !== targetLang) {
        await this.setLanguage(targetLang);
      }
      return this.workerInstance;
    }

    if (!this.isWorkerSupported || typeof window === "undefined" || typeof Worker === "undefined") {
      this.isWorkerSupported = false;
      return null;
    }

    if (!this.workerPromise) {
      this.initAttempted = true;
      this.workerPromise = (async () => {
        try {
          const worker = await createWorker(this.currentLanguage, 1, {
            logger: (m: any) => {
              if (this.currentProgressCallback && m) {
                const status = m.status || "processing";
                const progress = typeof m.progress === "number" ? m.progress : 0;
                if (status === "recognizing text") {
                  this.currentProgressCallback(50 + Math.round(progress * 40), `Scanning characters (${Math.round(progress * 100)}%)...`);
                } else if (status === "loading language traineddata") {
                  this.currentProgressCallback(25 + Math.round(progress * 15), "Loading OCR language model...");
                } else if (status === "initializing api") {
                  this.currentProgressCallback(45, "Initializing Tesseract engine...");
                }
              }
            },
            errorHandler: (e) => {
              console.warn("[OCRWorkerManager] Tesseract runtime notice:", e);
            },
          });
          this.workerInstance = worker;
          this.isWorkerSupported = true;
          return worker;
        } catch (err) {
          // In sandboxed iframes or environments with CSP restrictions, web workers may be blocked.
          // Gracefully fallback to Server Vision OCR without triggering an unhandled error alert.
          console.warn("[OCRWorkerManager] Client Tesseract worker unavailable in this environment (using Server Vision OCR fallback).");
          this.isWorkerSupported = false;
          this.workerInstance = null;
          this.workerPromise = null;
          return null;
        }
      })();
    }

    return this.workerPromise;
  }

  /**
   * Pre-warm the persistent OCR worker in the background on app launch (if supported)
   */
  public preloadWorker(): void {
    if (typeof window === "undefined" || typeof Worker === "undefined" || !this.isWorkerSupported) {
      return;
    }

    if (!this.initAttempted && !this.workerPromise && !this.workerInstance) {
      this.getWorker().catch(() => {
        this.isWorkerSupported = false;
      });
    }
  }

  /**
   * Run OCR recognition with concurrency mutex
   * If client worker is unavailable, automatically routes to Server Vision OCR.
   */
  public async recognize(
    imageSource: string | File | Blob,
    onProgress?: (progress: number, status: string) => void,
    options?: OCROptions
  ): Promise<OCRResult> {
    const skipPreprocessing = options?.skipPreprocessing ?? false;
    const requestedLang = options?.lang || this.currentLanguage;

    return new Promise<OCRResult>((resolve) => {
      const task = async () => {
        try {
          this.currentProgressCallback = onProgress || null;
          if (onProgress) onProgress(10, "Optimizing image contrast & sharpness for OCR...");

          let processedImage = imageSource;
          if (!skipPreprocessing) {
            try {
              processedImage = await preprocessImageForOcr(imageSource);
            } catch {
              processedImage = imageSource;
            }
          }

          if (onProgress) onProgress(30, "Checking OCR Engine availability...");
          const worker = await this.getWorker(requestedLang);

          if (!worker) {
            // Client worker unavailable in this iframe sandbox -> Fallback to Server Vision OCR
            if (onProgress) onProgress(50, "Scanning with Server Vision OCR...");
            try {
              const base64Payload = await toBase64String(processedImage);
              const serverResult = await extractTextServerOCR(base64Payload);
              resolve(serverResult);
              return;
            } catch {
              resolve(this.createEmptyFallbackResult());
              return;
            }
          }

          if (onProgress) onProgress(60, "Scanning text on image...");
          const ret = await worker.recognize(processedImage);

          if (onProgress) onProgress(90, "Extracting structured entities & formatting...");
          const rawText = ret.data?.text || "";
          const cleanText = rawText.trim();
          const confidence = Math.round(ret.data?.confidence || 0);
          const isLowConfidence = confidence < 65 && cleanText.length > 0;

          const lines = cleanText.split("\n").filter((l: string) => l.trim().length > 0);
          const words = cleanText.split(/\s+/).filter((w: string) => w.trim().length > 0);
          const entities = extractStructuredEntitiesFromText(cleanText);
          const hasUrduOrArabic = hasUrduOrArabicScript(cleanText);

          resolve({
            success: true,
            text: cleanText,
            ocrText: cleanText,
            confidence,
            isLowConfidence,
            lines,
            words,
            provider: "Tesseract.js (Enhanced Preprocessed)",
            entities,
            hasUrduOrArabic,
          });
        } catch (err: any) {
          console.warn("[OCRWorkerManager] Client recognize notice, using fallback:", err?.message || err);
          this.workerInstance = null;
          this.workerPromise = null;

          // Attempt server fallback
          try {
            const base64Payload = await toBase64String(imageSource);
            const serverResult = await extractTextServerOCR(base64Payload);
            resolve(serverResult);
          } catch {
            resolve(this.createEmptyFallbackResult());
          }
        } finally {
          this.currentProgressCallback = null;
        }
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  private createEmptyFallbackResult(): OCRResult {
    return {
      success: false,
      text: "",
      ocrText: "",
      confidence: 0,
      isLowConfidence: true,
      lines: [],
      words: [],
      provider: "OCR Standby (Vision Fallback)",
      entities: {
        dates: [],
        phoneNumbers: [],
        emails: [],
        urls: [],
        amounts: [],
        trackingNumbers: [],
      },
    };
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        try {
          await nextTask();
        } catch (e) {
          console.warn("[OCRWorkerManager] Queue task execution notice:", e);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  public async terminate(): Promise<void> {
    if (this.workerInstance) {
      try {
        await this.workerInstance.terminate();
      } catch {}
      this.workerInstance = null;
      this.workerPromise = null;
    }
  }
}

export const ocrWorkerManager = new OCRWorkerManager();

/**
 * Free client-side OCR text extraction using reusable persistent Tesseract worker with server fallback
 */
export async function extractTextClientOCR(
  imageSource: string | File | Blob,
  onProgress?: (progress: number, status: string) => void,
  options?: OCROptions
): Promise<OCRResult> {
  return ocrWorkerManager.recognize(imageSource, onProgress, options);
}

/**
 * Extract OCR text via Server API (OCR.Space API with Tesseract & Vision fallback)
 * Uploads screenshot using multipart/form-data
 */
export async function extractTextServerOCR(
  input: string | File | Blob,
  fileName: string = "screenshot.png"
): Promise<OCRResult> {
  try {
    const formData = new FormData();

    if (typeof input !== "string") {
      formData.append("file", input, fileName);
    } else if (input.startsWith("data:")) {
      // Convert data URL to Blob for clean multipart/form-data transfer
      const [header, base64Data] = input.split(",");
      const mimeMatch = header.match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      formData.append("file", blob, fileName);
    } else {
      // Raw base64 string
      const byteCharacters = atob(input);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/png" });
      formData.append("file", blob, fileName);
    }

    const response = await fetch("/api/ocr", {
      method: "POST",
      body: formData, // Browser automatically sets Content-Type: multipart/form-data with boundary
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    const extractedText = (data.ocrText || data.text || "").trim();
    const confidence = data.confidence || 95;
    const isLowConfidence = confidence < 65;
    const entities = extractStructuredEntitiesFromText(extractedText);

    return {
      success: true,
      text: extractedText,
      ocrText: extractedText,
      confidence,
      isLowConfidence,
      entities,
      lines: extractedText.split("\n").filter((l: string) => l.trim()),
      words: extractedText.split(/\s+/).filter((w: string) => w.trim()),
      provider: data.provider || "OCR.Space Cloud Engine",
    };
  } catch (error: any) {
    console.warn("Server OCR notice:", error?.message || error);
    // If client worker is explicitly supported, try client OCR
    if (typeof input === "string" && ocrWorkerManager.isSupported()) {
      return extractTextClientOCR(input);
    }
    return {
      success: false,
      text: "",
      ocrText: "",
      confidence: 0,
      isLowConfidence: true,
      lines: [],
      words: [],
      provider: "OCR Standby",
      entities: {
        dates: [],
        phoneNumbers: [],
        emails: [],
        urls: [],
        amounts: [],
        trackingNumbers: [],
      },
    };
  }
}
