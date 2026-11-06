import { ScreenshotItem, SearchResultMatch, CategoryType } from "../types";
import { loadSearchHistory, saveSearchHistory } from "./storage";
import { collectionSecurity } from "./collectionSecurity";
import { isFinanceOrPaymentScreenshot } from "./smartSnapsClassifier";
import { calculatePerceptualSimilarity } from "../utils/hashUtils";
import FlexSearch from "flexsearch";

export interface SearchFilters {
  type?: "all" | "screenshots_only" | "photos_only";
  isFavorite?: boolean;
  category?: CategoryType | "All" | string;
  folder?: string;
  sourceApp?: string;
  color?: string;
  tag?: string;
  dateRange?: {
    startDate?: string | number;
    endDate?: string | number;
  };
}

export interface SearchOptions {
  filters?: SearchFilters;
  limit?: number;
  minScore?: number;
}

export interface SearchSuggestion {
  text: string;
  type: "history" | "tag" | "category" | "intent";
  category?: CategoryType;
}

/**
 * Weighted ranking field configuration matrix
 */
export const SEARCH_FIELD_WEIGHTS = {
  title: 3.5,
  sourceApp: 3.2,
  entities: 3.2,
  category: 3.0,
  website: 2.8,
  qr: 2.8,
  objects: 2.8,
  colors: 2.5,
  keywords: 2.5,
  tags: 2.5,
  visuals: 2.2,
  summary: 2.0,
  description: 1.8,
  ocr: 1.5,
  filename: 1.2,
} as const;

/**
 * Tokenize text into lowercase alphanumeric words
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Compute Levenshtein edit distance for misspelling tolerance
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row: number[] = [];
  for (let i = 0; i <= a.length; i++) {
    row[i] = i;
  }

  for (let i = 1; i <= b.length; i++) {
    let prev = i;
    for (let j = 1; j <= a.length; j++) {
      let val: number;
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }

  return row[a.length];
}

/**
 * Common typo & abbreviation dictionary for auto-correcting search queries
 */
const COMMON_TYPOS_MAP: Record<string, string> = {
  pasport: "passport",
  passprt: "passport",
  paspor: "passport",
  eletrcity: "electricity",
  electrcity: "electricity",
  elec: "electricity",
  amazn: "amazon",
  amzon: "amazon",
  watsapp: "whatsapp",
  whatapp: "whatsapp",
  whatsApp: "whatsapp",
  utube: "youtube",
  ytube: "youtube",
  youtub: "youtube",
  reciept: "receipt",
  receit: "receipt",
  invoise: "invoice",
  invice: "invoice",
  tikut: "ticket",
  tikit: "ticket",
  dokument: "document",
  documnt: "document",
};

export function normalizeAndCorrectToken(token: string): string {
  const lower = token.toLowerCase().trim();
  return COMMON_TYPOS_MAP[lower] || lower;
}

/**
 * Compute fuzzy token match score (0.0 - 1.0) with misspelling tolerance
 */
/**
 * Normalize common OCR glyph substitutions:
 * 0 <-> O, 1 <-> l/I/|, 5 <-> S, 8 <-> B, 2 <-> Z, rn <-> m, vv <-> w
 */
export function normalizeOcrSubstitutions(str: string): string {
  return str
    .toLowerCase()
    .replace(/[0o]/g, "0")
    .replace(/[1il|!]/g, "1")
    .replace(/[5s]/g, "5")
    .replace(/[8b]/g, "8")
    .replace(/[2z]/g, "2")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

/**
 * Extract matched snippet around search terms from OCR text with context window
 */
export function extractMatchedOcrSnippet(
  text: string,
  queryTokens: string[],
  maxLength: number = 140
): { snippet: string; matchedTerms: string[] } {
  if (!text || !text.trim()) return { snippet: "", matchedTerms: [] };

  const cleanText = text.replace(/\r\n/g, "\n").trim();
  const lowerText = cleanText.toLowerCase();
  const matchedTerms: string[] = [];
  let bestIndex = -1;

  for (const token of queryTokens) {
    if (!token || token.length < 2) continue;
    const cleanTok = token.toLowerCase();
    const idx = lowerText.indexOf(cleanTok);
    if (idx !== -1) {
      if (!matchedTerms.includes(token)) {
        matchedTerms.push(token);
      }
      if (bestIndex === -1 || idx < bestIndex) {
        bestIndex = idx;
      }
    }
  }

  // If no exact token found, check OCR-normalized substitutions
  if (bestIndex === -1) {
    for (const token of queryTokens) {
      if (!token || token.length < 3) continue;
      const normTok = normalizeOcrSubstitutions(token);
      const words = cleanText.split(/[\s\n]+/);
      let searchOffset = 0;
      for (const word of words) {
        const normWord = normalizeOcrSubstitutions(word);
        if (normWord.includes(normTok)) {
          const foundIdx = lowerText.indexOf(word.toLowerCase(), searchOffset);
          if (foundIdx !== -1) {
            bestIndex = foundIdx;
            matchedTerms.push(word);
            break;
          }
        }
        searchOffset += word.length + 1;
      }
      if (bestIndex !== -1) break;
    }
  }

  if (bestIndex === -1) {
    const fallback = cleanText.slice(0, maxLength);
    return {
      snippet: fallback.length < cleanText.length ? `${fallback}...` : fallback,
      matchedTerms: [],
    };
  }

  // Extract excerpt around best match
  const start = Math.max(0, bestIndex - 40);
  const end = Math.min(cleanText.length, bestIndex + maxLength - 40);

  let snippet = cleanText.slice(start, end).replace(/\n+/g, " ").trim();
  if (start > 0) snippet = `...${snippet}`;
  if (end < cleanText.length) snippet = `${snippet}...`;

  return { snippet, matchedTerms };
}

/**
 * Compute fuzzy token match score (0.0 - 1.0) with misspelling tolerance & OCR confusion matrix
 */
function computeTokenFuzzyScore(queryToken: string, targetWord: string): number {
  const q = normalizeAndCorrectToken(queryToken);
  const w = targetWord.toLowerCase().trim();

  if (!q || !w) return 0;

  // Exact match
  if (q === w) return 1.0;

  // Prefix match: word in document starts with query token (e.g. document has "monthly", query is "month" or "mon")
  if (w.startsWith(q) && q.length >= 2) return 0.88;

  // Substring match: query token is contained inside target word (e.g. "report" in "salesreport")
  if (w.includes(q) && q.length >= 3) return 0.82;

  // Query is longer than target word (e.g. query is "monthly" and target word is "month")
  if (q.startsWith(w) && w.length >= 4) return 0.80;

  // OCR glyph confusion match (e.g. "O98241" vs "098241", "1nvoice" vs "invoice")
  if (q.length >= 3 && w.length >= 3) {
    const ocrQ = normalizeOcrSubstitutions(q);
    const ocrW = normalizeOcrSubstitutions(w);
    if (ocrQ === ocrW) return 0.94;
    if (ocrW.includes(ocrQ)) return 0.88;
    if (ocrQ.includes(ocrW) && w.length >= 4) return 0.84;
  }

  // Levenshtein fuzzy match for real misspellings (e.g. "reciept" -> "receipt", "pasport" -> "passport")
  const maxLen = Math.max(q.length, w.length);
  if (maxLen < 5) return 0;

  const maxEdits = maxLen >= 8 ? 2 : 1;
  const dist = levenshteinDistance(q, w);

  if (dist <= maxEdits) {
    return Math.max(0.6, 1.0 - (dist / maxLen) * 0.45);
  }

  return 0;
}

/**
 * Parsed Natural Language Search Intent
 */
export interface QueryIntent {
  rawQuery: string;
  tokens: string[];
  cleanText: string;
  targetApp?: string; // e.g. "whatsapp", "youtube", "amazon"
  targetFormat?: string; // e.g. "passport", "electricity_bill", "amazon_order", "otp", "youtube_video", "document"
  colorDescriptor?: string; // e.g. "blue", "red", "green"
  timeFilter?: "last_month" | "last_week" | "yesterday" | "today" | "recent";
  isFavoriteIntent?: boolean;
  isScreenshotIntent?: boolean;
}

/**
 * Natural Language Query Parser understanding domain intents:
 * "passport", "My electricity bill", "Amazon order", "WhatsApp OTP", "YouTube video", "Blue document"
 */
export function parseQueryIntent(rawQuery: string): QueryIntent {
  const lower = rawQuery.toLowerCase().trim();
  const rawTokens = tokenize(rawQuery);
  const tokens = rawTokens.map(normalizeAndCorrectToken);

  let targetApp: string | undefined;
  let targetFormat: string | undefined;
  let colorDescriptor: string | undefined;
  let timeFilter: QueryIntent["timeFilter"];
  let isFavoriteIntent = false;
  let isScreenshotIntent = false;

  // App detection
  const apps = ["whatsapp", "youtube", "amazon", "instagram", "twitter", "telegram", "slack", "gmail", "chrome", "facebook", "linkedin"];
  for (const app of apps) {
    if (lower.includes(app) || tokens.includes(app)) {
      targetApp = app;
      break;
    }
  }

  // Domain Intent Detection
  if (lower.includes("passport") || lower.includes("pasport") || lower.includes("visa") || lower.includes("id card")) {
    targetFormat = "passport";
  } else if (
    lower.includes("qr code") ||
    lower.includes("qr") ||
    lower.includes("barcode") ||
    lower.includes("scanned code") ||
    lower.includes("wifi qr")
  ) {
    targetFormat = "qr_code";
  } else if (
    lower.includes("website") ||
    lower.includes("url") ||
    lower.includes("domain") ||
    lower.includes("webpage") ||
    lower.includes("web page") ||
    lower.includes("link")
  ) {
    targetFormat = "website";
  } else if (
    lower.includes("code") ||
    lower.includes("python") ||
    lower.includes("javascript") ||
    lower.includes("typescript") ||
    lower.includes("react") ||
    lower.includes("html") ||
    lower.includes("css") ||
    lower.includes("sql") ||
    lower.includes("function") ||
    lower.includes("snippet")
  ) {
    targetFormat = "code_snippet";
  } else if (
    lower.includes("diagram") ||
    lower.includes("chart") ||
    lower.includes("graph") ||
    lower.includes("wireframe") ||
    lower.includes("mockup") ||
    lower.includes("flowchart") ||
    lower.includes("plot")
  ) {
    targetFormat = "diagram";
  } else if (
    lower.includes("electricity") ||
    lower.includes("eletrcity") ||
    lower.includes("electric") ||
    lower.includes("power bill") ||
    lower.includes("light bill") ||
    (lower.includes("bill") && (lower.includes("utility") || lower.includes("kwh") || lower.includes("meter")))
  ) {
    targetFormat = "electricity_bill";
  } else if (lower.includes("amazon") || lower.includes("amazn") || (lower.includes("order") && lower.includes("amazon"))) {
    targetFormat = "amazon_order";
  } else if (
    lower.includes("otp") ||
    lower.includes("verification code") ||
    lower.includes("passcode") ||
    (lower.includes("whatsapp") && (lower.includes("code") || lower.includes("pin")))
  ) {
    targetFormat = "otp";
  } else if (lower.includes("youtube") || lower.includes("utube") || lower.includes("yt video") || (lower.includes("video") && lower.includes("youtube"))) {
    targetFormat = "youtube_video";
  } else if (lower.includes("document") || lower.includes("pdf") || lower.includes("certificate") || lower.includes("file")) {
    targetFormat = "document";
  } else if (lower.includes("receipt") || lower.includes("reciept") || lower.includes("invoice") || lower.includes("bill")) {
    targetFormat = "receipt";
  } else if (lower.includes("recipe") || lower.includes("food") || lower.includes("dish")) {
    targetFormat = "recipe";
  } else if (lower.includes("tracking") || lower.includes("track") || lower.includes("traking") || lower.includes("courier") || lower.includes("shipment")) {
    targetFormat = "tracking_number";
  } else if (lower.includes("phone") || lower.includes("mobile") || lower.includes("contact") || lower.includes("call")) {
    targetFormat = "phone_number";
  } else if (lower.includes("email") || lower.includes("e-mail") || lower.includes("mail address")) {
    targetFormat = "email_address";
  } else if (lower.includes("price") || lower.includes("cost") || lower.includes("laptop price") || lower.includes("rate") || lower.includes("amount") || lower.includes("pkr") || lower.includes("rs") || lower.includes("dollar")) {
    targetFormat = "price_amount";
  }

  // Color detection
  const colors = ["blue", "red", "green", "black", "white", "yellow", "purple", "dark", "cyan"];
  for (const color of colors) {
    if (tokens.includes(color) || lower.includes(color)) {
      colorDescriptor = color;
      break;
    }
  }

  // Time filter intent
  if (lower.includes("last month")) timeFilter = "last_month";
  else if (lower.includes("last week")) timeFilter = "last_week";
  else if (lower.includes("yesterday")) timeFilter = "yesterday";
  else if (lower.includes("today")) timeFilter = "today";
  else if (lower.includes("recent") || lower.includes("latest")) timeFilter = "recent";

  // Favorite / Screenshot intent
  if (lower.includes("favorite") || lower.includes("starred")) isFavoriteIntent = true;
  if (lower.includes("screenshot")) isScreenshotIntent = true;

  // Clean text by stripping conversational filler words
  const cleanText = lower
    .replace(/\b(show me|find my|get me|where|the|a|an|my|screenshot|image|photo|picture|containing|with|that has|sent|from|last month|last week|yesterday|today|recent)\b/gi, "")
    .trim();

  return {
    rawQuery,
    tokens,
    cleanText,
    targetApp,
    targetFormat,
    colorDescriptor,
    timeFilter,
    isFavoriteIntent,
    isScreenshotIntent,
  };
}

function extractWebsiteStrings(item: ScreenshotItem): string[] {
  const list: (string | undefined)[] = [
    item.website_name,
    item.websiteName,
    item.website_domain,
    item.websiteDomain,
    item.website_url,
    item.websiteUrl,
    item.website?.name,
    item.website?.domain,
    item.website?.url,
    item.website?.websiteUrl,
    ...(item.detected_urls || []),
    ...(item.detectedUrls || []),
    ...(item.urls || []),
    ...(item.website?.detectedUrls || []),
  ];
  return Array.from(new Set(list.filter(Boolean) as string[]));
}

function extractQrStrings(item: ScreenshotItem): string[] {
  const list: (string | undefined)[] = [
    item.qr_code_data,
    item.qrCodeData,
    item.qr_code_type,
    item.qrCodeType,
    item.qr_url,
    item.qrUrl,
    item.detected_qr,
  ];
  if (typeof item.qr_code === "string") {
    list.push(item.qr_code);
  } else if (item.qr_code && typeof item.qr_code === "object") {
    list.push(item.qr_code.data, item.qr_code.type, item.qr_code.url);
  }
  return Array.from(new Set(list.filter(Boolean) as string[]));
}

function extractVisualFeatureStrings(item: ScreenshotItem): string[] {
  if (!item.visual_features) return [];
  if (Array.isArray(item.visual_features)) return item.visual_features;
  return [item.visual_features.visualType, ...(item.visual_features.dominantColors || [])].filter(Boolean) as string[];
}

/**
 * High-Performance Inverted Search Index (<100ms execution target)
 */
class InvertedSearchIndex {
  private index: Map<string, Set<string>> = new Map();
  private itemsMap: Map<string, ScreenshotItem> = new Map();

  public buildIndex(items: ScreenshotItem[]): void {
    this.index.clear();
    this.itemsMap.clear();

    for (const item of items) {
      this.itemsMap.set(item.id, item);
      const textToTokenize = [
        item.title,
        item.summary,
        item.ai_description,
        item.description,
        item.fullText,
        item.ocr_text,
        item.category,
        item.fileName,
        item.file_name,
        item.folder,
        ...extractWebsiteStrings(item),
        ...extractQrStrings(item),
        ...extractVisualFeatureStrings(item),
        ...(item.tags || []),
        ...(item.keyEntities || []),
        ...(item.keywords || []),
        ...(item.objects || []),
        ...(item.objectsDetected || []),
      ]
        .filter(Boolean)
        .join(" ");

      const tokens = tokenize(textToTokenize);
      for (const token of tokens) {
        if (!this.index.has(token)) {
          this.index.set(token, new Set());
        }
        this.index.get(token)!.add(item.id);
      }
    }
  }

  public updateItem(item: ScreenshotItem): void {
    this.itemsMap.set(item.id, item);
    const textToTokenize = [
      item.title,
      item.summary,
      item.ai_description,
      item.description,
      item.fullText,
      item.ocr_text,
      item.category,
      item.fileName,
      item.file_name,
      item.folder,
      ...extractWebsiteStrings(item),
      ...extractQrStrings(item),
      ...extractVisualFeatureStrings(item),
      ...(item.tags || []),
      ...(item.keyEntities || []),
      ...(item.keywords || []),
      ...(item.objects || []),
      ...(item.objectsDetected || []),
    ]
      .filter(Boolean)
      .join(" ");

    const tokens = tokenize(textToTokenize);
    for (const token of tokens) {
      if (!this.index.has(token)) {
        this.index.set(token, new Set());
      }
      this.index.get(token)!.add(item.id);
    }
  }

  public removeItem(id: string): void {
    this.itemsMap.delete(id);
    for (const [, docSet] of this.index.entries()) {
      docSet.delete(id);
    }
  }
}

/**
 * SnapFind AI Search Engine with Weighted Ranking, Misspelling Tolerance, and Natural Language Intent
 */
export class SnapFindSearchEngine {
  private invertedIndex: InvertedSearchIndex = new InvertedSearchIndex();
  private cachedItems: ScreenshotItem[] = [];
  private flexIndex: any;

  constructor() {
    this.initFlexSearch();
  }

  private initFlexSearch(): void {
    try {
      this.flexIndex = new FlexSearch.Document({
        document: {
          id: "id",
          index: [
            "title",
            "category",
            "objects",
            "keywords",
            "tags",
            "summary",
            "description",
            "ocr_text",
            "fileName",
          ],
        },
        tokenize: "forward",
      });
    } catch (e) {
      console.warn("[SearchEngine] FlexSearch initialization error:", e);
    }
  }

  private buildFlexDoc(item: ScreenshotItem): any {
    return {
      id: item.id,
      title: item.title || "",
      category: item.category || "",
      objects: (item.objects || item.objectsDetected || []).join(" "),
      keywords: (item.keywords || item.keyEntities || []).join(" "),
      tags: (item.tags || []).join(" "),
      summary: item.summary || "",
      description: item.description || item.ai_description || "",
      ocr_text: item.fullText || item.ocr_text || "",
      fileName: item.fileName || item.file_name || "",
      website: extractWebsiteStrings(item).join(" "),
      qr_code: extractQrStrings(item).join(" "),
      visuals: extractVisualFeatureStrings(item).join(" "),
    };
  }

  public updateIndex(items: ScreenshotItem[]): void {
    this.cachedItems = items;
    this.invertedIndex.buildIndex(items);
    this.initFlexSearch();
    if (this.flexIndex) {
      items.forEach((item) => {
        try {
          this.flexIndex.add(this.buildFlexDoc(item));
        } catch (e) {}
      });
    }
  }

  public updateItem(item: ScreenshotItem): void {
    const existingIndex = this.cachedItems.findIndex((s) => s.id === item.id);
    if (existingIndex >= 0) {
      this.cachedItems[existingIndex] = item;
    } else {
      this.cachedItems.unshift(item);
    }
    this.invertedIndex.updateItem(item);
    if (this.flexIndex) {
      try {
        this.flexIndex.add(this.buildFlexDoc(item));
      } catch (e) {}
    }
  }

  public updateItems(items: ScreenshotItem[]): void {
    if (!items || items.length === 0) return;
    for (const item of items) {
      const existingIndex = this.cachedItems.findIndex((s) => s.id === item.id);
      if (existingIndex >= 0) {
        this.cachedItems[existingIndex] = item;
      } else {
        this.cachedItems.unshift(item);
      }
      this.invertedIndex.updateItem(item);
      if (this.flexIndex) {
        try {
          this.flexIndex.add(this.buildFlexDoc(item));
        } catch (e) {}
      }
    }
  }

  public removeItem(id: string): void {
    this.cachedItems = this.cachedItems.filter((s) => s.id !== id);
    this.invertedIndex.removeItem(id);
    if (this.flexIndex) {
      try {
        this.flexIndex.remove(id);
      } catch (e) {}
    }
  }

  public deleteItem(id: string): void {
    this.removeItem(id);
  }

  /**
   * Execute Hybrid Weighted Natural Language Search
   */
  public search(
    query: string,
    items: ScreenshotItem[],
    options: SearchOptions = {}
  ): SearchResultMatch[] {
    if (!query || !query.trim()) return [];

    if (this.cachedItems !== items) {
      this.updateIndex(items);
    }

    const intent = parseQueryIntent(query);
    const filters = options.filters || {};

    const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    // 1. Filter candidates by structural rules
    const candidates = items.filter((item) => {
      // Security filter: items inside locked collections or locked vault are hidden until unlocked
      if (!collectionSecurity.isItemAccessible(item)) {
        return false;
      }

      if (filters.type === "screenshots_only" && !item.isScreenshot && !item.is_screenshot) return false;
      if (filters.type === "photos_only" && (item.isScreenshot || item.is_screenshot)) return false;

      if (filters.isFavorite && !item.isFavorite && !item.favorite) return false;

      if (filters.category && filters.category !== "All") {
        if (item.category.toLowerCase() !== String(filters.category).toLowerCase()) return false;
      }

      if (filters.folder && item.folder) {
        if (item.folder.toLowerCase() !== filters.folder.toLowerCase()) return false;
      }

      if (filters.sourceApp && filters.sourceApp !== "all" && filters.sourceApp !== "All") {
        const itemApp = (item.source_app || item.sourceApp || "").toLowerCase();
        if (!itemApp.includes(filters.sourceApp.toLowerCase())) return false;
      }

      if (filters.color) {
        const itemColors = (item.colors || []).map((c) => c.toLowerCase());
        const targetColor = filters.color.toLowerCase();
        const matched = itemColors.some((c) => c.includes(targetColor) || targetColor.includes(c));
        if (!matched) return false;
      }

      if (filters.tag) {
        const itemTags = (item.tags || []).map((t) => t.toLowerCase());
        if (!itemTags.includes(filters.tag.toLowerCase())) return false;
      }

      if (filters.dateRange) {
        const itemDate = new Date(item.createdAt || (item as any).created_at || (item as any).indexedAt || (item as any).date_created || 0).getTime();
        if (filters.dateRange.startDate) {
          const start = new Date(filters.dateRange.startDate).getTime();
          if (itemDate < start) return false;
        }
        if (filters.dateRange.endDate) {
          const end = new Date(filters.dateRange.endDate).getTime();
          if (itemDate > end) return false;
        }
      }

      return true;
    });

    // 2. Score and Rank candidates using weighted ranking
    const results: SearchResultMatch[] = candidates
      .map((item) => this.scoreItem(item, intent))
      .filter((res) => res.score >= (options.minScore ?? 0.10))
      .sort((a, b) => b.score - a.score);

    const latencyMs = Math.max(
      0.5,
      Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime) * 10) / 10
    );
    results.forEach((r) => {
      r.latencyMs = latencyMs;
    });

    // Save query to recent search history
    if (results.length > 0) {
      this.saveSearchHistory(query, results.length, filters.category as CategoryType);
    }

    return options.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Weighted Search Ranking Algorithm:
   * Title (3.5), Category (3.0), Objects (2.8), Keywords (2.5), Tags (2.5),
   * Summary (2.0), Description (1.8), OCR (1.5), Filename (1.2)
   */
  private scoreItem(item: ScreenshotItem, intent: QueryIntent): SearchResultMatch {
    let accumulatedWeightedScore = 0;
    const matchReasons: string[] = [];

    // Fields to evaluate with their respective weights
    const fieldsMap: Array<{
      name: string;
      weight: number;
      text: string;
      tokens: string[];
    }> = [
      {
        name: "title",
        weight: SEARCH_FIELD_WEIGHTS.title,
        text: item.title || "",
        tokens: tokenize(item.title || ""),
      },
      {
        name: "sourceApp",
        weight: SEARCH_FIELD_WEIGHTS.sourceApp,
        text: item.source_app || item.sourceApp || "",
        tokens: tokenize(item.source_app || item.sourceApp || ""),
      },
      {
        name: "colors",
        weight: SEARCH_FIELD_WEIGHTS.colors,
        text: (item.colors || []).join(" "),
        tokens: (item.colors || []).flatMap(tokenize),
      },
      {
        name: "entities",
        weight: SEARCH_FIELD_WEIGHTS.entities,
        text: [
          ...(item.extractedEntities?.trackingNumbers || []),
          ...(item.extractedEntities?.phoneNumbers || []),
          ...(item.extractedEntities?.emails || []),
          ...(item.extractedEntities?.amounts || []),
          ...(item.extractedEntities?.dates || []),
          ...(item.extractedEntities?.urls || []),
        ].join(" "),
        tokens: [
          ...(item.extractedEntities?.trackingNumbers || []),
          ...(item.extractedEntities?.phoneNumbers || []),
          ...(item.extractedEntities?.emails || []),
          ...(item.extractedEntities?.amounts || []),
          ...(item.extractedEntities?.dates || []),
        ].flatMap(tokenize),
      },
      {
        name: "category",
        weight: SEARCH_FIELD_WEIGHTS.category,
        text: item.category || "",
        tokens: tokenize(item.category || ""),
      },
      {
        name: "objects",
        weight: SEARCH_FIELD_WEIGHTS.objects,
        text: [...(item.objects || []), ...(item.objectsDetected || [])].join(" "),
        tokens: [...(item.objects || []), ...(item.objectsDetected || [])].flatMap(tokenize),
      },
      {
        name: "keywords",
        weight: SEARCH_FIELD_WEIGHTS.keywords,
        text: [...(item.keyEntities || []), ...(item.keywords || [])].join(" "),
        tokens: [...(item.keyEntities || []), ...(item.keywords || [])].flatMap(tokenize),
      },
      {
        name: "tags",
        weight: SEARCH_FIELD_WEIGHTS.tags,
        text: (item.tags || []).join(" "),
        tokens: (item.tags || []).flatMap(tokenize),
      },
      {
        name: "summary",
        weight: SEARCH_FIELD_WEIGHTS.summary,
        text: item.summary || "",
        tokens: tokenize(item.summary || ""),
      },
      {
        name: "description",
        weight: SEARCH_FIELD_WEIGHTS.description,
        text: item.description || item.ai_description || "",
        tokens: tokenize(item.description || item.ai_description || ""),
      },
      {
        name: "website",
        weight: SEARCH_FIELD_WEIGHTS.website,
        text: extractWebsiteStrings(item).join(" "),
        tokens: extractWebsiteStrings(item).flatMap((s) => tokenize(s || "")),
      },
      {
        name: "qr",
        weight: SEARCH_FIELD_WEIGHTS.qr,
        text: extractQrStrings(item).join(" "),
        tokens: extractQrStrings(item).flatMap((s) => tokenize(s || "")),
      },
      {
        name: "visuals",
        weight: SEARCH_FIELD_WEIGHTS.visuals,
        text: extractVisualFeatureStrings(item).join(" "),
        tokens: extractVisualFeatureStrings(item).flatMap((s) => tokenize(s || "")),
      },
      {
        name: "ocr",
        weight: SEARCH_FIELD_WEIGHTS.ocr,
        text: item.fullText || item.ocr_text || "",
        tokens: tokenize(item.fullText || item.ocr_text || ""),
      },
      {
        name: "filename",
        weight: SEARCH_FIELD_WEIGHTS.filename,
        text: item.fileName || item.file_name || "",
        tokens: tokenize(item.fileName || item.file_name || ""),
      },
    ];

    const cleanQueryTokens = intent.tokens.filter(
      (t) => !["show", "me", "find", "get", "my", "the", "a", "an", "image", "screenshot", "photo"].includes(t)
    );
    const queryTokenCount = Math.max(1, cleanQueryTokens.length);
    let matchedTokenCount = 0;

    // Evaluate each query token against weighted fields with fuzzy misspelling matching
    for (const qToken of cleanQueryTokens) {
      let bestTokenMatchScore = 0;
      let matchedFieldName = "";

      for (const field of fieldsMap) {
        if (!field.text) continue;

        // Compare query token against field words
        for (const targetWord of field.tokens) {
          const matchQuality = computeTokenFuzzyScore(qToken, targetWord);
          if (matchQuality > bestTokenMatchScore) {
            bestTokenMatchScore = matchQuality;
            matchedFieldName = field.name;
          }
        }

        // Also check if field full text contains the query token as substring
        if (field.text.toLowerCase().includes(qToken.toLowerCase())) {
          bestTokenMatchScore = Math.max(bestTokenMatchScore, 0.85);
          matchedFieldName = field.name;
        }
      }

      if (bestTokenMatchScore > 0) {
        matchedTokenCount++;
        const fieldWeight = SEARCH_FIELD_WEIGHTS[matchedFieldName as keyof typeof SEARCH_FIELD_WEIGHTS] || 1.0;
        accumulatedWeightedScore += bestTokenMatchScore * fieldWeight;
      }
    }

    // Natural Language Intent Boosts
    let intentMatchBoost = 0;

    // QR Code Intent
    if (intent.targetFormat === "qr_code") {
      const qrStrings = extractQrStrings(item);
      const isQr =
        qrStrings.length > 0 ||
        item.has_qr_code ||
        item.hasQrCode ||
        (typeof item.qr_code === "object" && item.qr_code?.hasQrCode) ||
        (item.tags || []).some((t) => t.toLowerCase().includes("qr"));
      if (isQr) {
        intentMatchBoost += 0.60;
        matchReasons.push("Matched QR Code Payload");
      }
    }

    // Website / URL Intent
    if (intent.targetFormat === "website") {
      const siteStrings = extractWebsiteStrings(item);
      if (siteStrings.length > 0 || item.website_url || item.website_domain || item.websiteUrl) {
        intentMatchBoost += 0.50;
        matchReasons.push(`Matched Website (${item.website?.name || item.website?.domain || item.website_name || "URL"})`);
      }
    }

    // Code Snippet Intent
    if (intent.targetFormat === "code_snippet") {
      const catLower = (item.category || "").toLowerCase();
      const ocrLower = (item.fullText || item.ocr_text || "").toLowerCase();
      const tagsLower = (item.tags || []).map((t) => t.toLowerCase());
      const hasCodeVisual =
        typeof item.visual_features === "object" && !Array.isArray(item.visual_features)
          ? item.visual_features.hasCode
          : false;

      if (
        catLower.includes("code") ||
        catLower.includes("development") ||
        tagsLower.includes("code") ||
        tagsLower.includes("programming") ||
        hasCodeVisual ||
        ocrLower.includes("function") ||
        ocrLower.includes("const ") ||
        ocrLower.includes("def ") ||
        ocrLower.includes("import ")
      ) {
        intentMatchBoost += 0.55;
        matchReasons.push("Matched Code Snippet");
      }
    }

    // Diagram / Chart Intent
    if (intent.targetFormat === "diagram") {
      const catLower = (item.category || "").toLowerCase();
      const tagsLower = (item.tags || []).map((t) => t.toLowerCase());
      const objectsLower = [...(item.objects || []), ...(item.objectsDetected || [])].map((o) => o.toLowerCase());
      const hasChartVisual =
        typeof item.visual_features === "object" && !Array.isArray(item.visual_features)
          ? item.visual_features.hasCharts || item.visual_features.isDiagram
          : false;

      if (
        catLower.includes("diagram") ||
        catLower.includes("design") ||
        hasChartVisual ||
        tagsLower.includes("chart") ||
        tagsLower.includes("diagram") ||
        objectsLower.includes("diagram") ||
        objectsLower.includes("chart")
      ) {
        intentMatchBoost += 0.50;
        matchReasons.push("Matched Visual Diagram/Chart");
      }
    }

    // Passport Intent
    if (intent.targetFormat === "passport") {
      const catLower = (item.category || "").toLowerCase();
      const ocrLower = (item.fullText || item.ocr_text || "").toLowerCase();
      const titleLower = (item.title || "").toLowerCase();

      if (catLower.includes("passport") || titleLower.includes("passport") || ocrLower.includes("republic") || ocrLower.includes("passport")) {
        intentMatchBoost += 0.50;
        matchReasons.push("Matched Passport Document");
      }
    }

    // Electricity Bill Intent
    if (intent.targetFormat === "electricity_bill") {
      const catLower = (item.category || "").toLowerCase();
      const ocrLower = (item.fullText || item.ocr_text || "").toLowerCase();
      const summaryLower = (item.summary || "").toLowerCase();

      if (
        catLower.includes("electricity") ||
        catLower.includes("bill") ||
        ocrLower.includes("kwh") ||
        ocrLower.includes("power") ||
        ocrLower.includes("meter") ||
        summaryLower.includes("electricity")
      ) {
        intentMatchBoost += 0.50;
        matchReasons.push("Matched Electricity Bill");
      }
    }

    // Amazon Order Intent
    if (intent.targetFormat === "amazon_order" || intent.targetApp === "amazon") {
      const catLower = (item.category || "").toLowerCase();
      const ocrLower = (item.fullText || item.ocr_text || "").toLowerCase();
      const titleLower = (item.title || "").toLowerCase();

      if (
        titleLower.includes("amazon") ||
        ocrLower.includes("amazon") ||
        catLower.includes("e-commerce") ||
        ocrLower.includes("delivered") ||
        ocrLower.includes("order #")
      ) {
        intentMatchBoost += 0.50;
        matchReasons.push("Matched Amazon Order");
      }
    }

    // WhatsApp OTP Intent
    if (intent.targetFormat === "otp" || (intent.targetApp === "whatsapp" && intent.tokens.includes("otp"))) {
      const ocrLower = (item.fullText || item.ocr_text || "").toLowerCase();
      const titleLower = (item.title || "").toLowerCase();

      if (
        titleLower.includes("whatsapp") ||
        ocrLower.includes("whatsapp") ||
        ocrLower.includes("otp") ||
        ocrLower.includes("verification code") ||
        /\b\d{4,6}\b/.test(ocrLower)
      ) {
        intentMatchBoost += 0.50;
        matchReasons.push("Matched WhatsApp OTP");
      }
    }

    // YouTube Video Intent
    if (intent.targetFormat === "youtube_video" || intent.targetApp === "youtube") {
      const titleLower = (item.title || "").toLowerCase();
      const ocrLower = (item.fullText || item.ocr_text || "").toLowerCase();
      const summaryLower = (item.summary || "").toLowerCase();

      if (
        titleLower.includes("youtube") ||
        ocrLower.includes("youtube") ||
        summaryLower.includes("youtube") ||
        ocrLower.includes("subscribers") ||
        ocrLower.includes("subscribe")
      ) {
        intentMatchBoost += 0.50;
        matchReasons.push("Matched YouTube Video");
      }
    }

    // Financial & Banking Intent (e.g. "Find my payment screenshot", "bank transfer", "receipt")
    const queryLower = intent.rawQuery.toLowerCase();
    const isFinancialQuery =
      queryLower.includes("bank") ||
      queryLower.includes("payment") ||
      queryLower.includes("transfer") ||
      queryLower.includes("upi") ||
      queryLower.includes("transaction") ||
      queryLower.includes("receipt") ||
      queryLower.includes("invoice") ||
      queryLower.includes("money");

    if (isFinancialQuery && (isFinanceOrPaymentScreenshot(item) || item.category === "Financial" || item.smart_category === "Banking")) {
      intentMatchBoost += 0.60;
      matchReasons.push("Matched Banking & Payment Snaps");
    }

    // Color Document Intent (e.g. "Blue document", "blue laptop")
    if (intent.colorDescriptor) {
      const itemColors = (item.colors || []).map((c) => c.toLowerCase());
      const tagsLower = (item.tags || []).map((t) => t.toLowerCase());
      const objectsLower = [...(item.objects || []), ...(item.objectsDetected || [])].map((o) => o.toLowerCase());
      const summaryLower = (item.summary || "").toLowerCase();

      const colorMatch =
        itemColors.some((c) => c.includes(intent.colorDescriptor!) || intent.colorDescriptor!.includes(c)) ||
        tagsLower.includes(intent.colorDescriptor) ||
        objectsLower.includes(intent.colorDescriptor) ||
        summaryLower.includes(intent.colorDescriptor);

      if (colorMatch) {
        intentMatchBoost += 0.45;
        matchReasons.push(`Color match (${intent.colorDescriptor})`);
      }
    }

    // Source App Intent (e.g. "WhatsApp conversation", "Amazon order", "Slack")
    const appQuery = (item.source_app || item.sourceApp || "").toLowerCase();
    if (appQuery && (
      (intent.targetApp && appQuery.includes(intent.targetApp)) ||
      intent.rawQuery.toLowerCase().includes(appQuery)
    )) {
      intentMatchBoost += 0.50;
      matchReasons.push(`Source app (${item.source_app || item.sourceApp})`);
    }

    // Tracking Number Intent Boost
    if (intent.targetFormat === "tracking_number") {
      const trackingIds = item.extractedEntities?.trackingNumbers || [];
      const ocrLower = (item.fullText || item.ocr_text || "").toLowerCase();
      if (trackingIds.length > 0) {
        intentMatchBoost += 0.85;
        matchReasons.push(`Matched Tracking ID (${trackingIds[0]})`);
      } else if (ocrLower.includes("tracking") || ocrLower.includes("consignment") || ocrLower.includes("shipment")) {
        intentMatchBoost += 0.40;
        matchReasons.push("Matched Tracking keyword");
      }
    }

    // Phone Number Intent Boost
    if (intent.targetFormat === "phone_number") {
      const phones = item.extractedEntities?.phoneNumbers || [];
      if (phones.length > 0) {
        intentMatchBoost += 0.85;
        matchReasons.push(`Matched Phone Number (${phones[0]})`);
      }
    }

    // Email Address Intent Boost
    if (intent.targetFormat === "email_address") {
      const emails = item.extractedEntities?.emails || [];
      if (emails.length > 0) {
        intentMatchBoost += 0.85;
        matchReasons.push(`Matched Email (${emails[0]})`);
      }
    }

    // Price / Amount Intent Boost
    if (intent.targetFormat === "price_amount") {
      const amounts = item.extractedEntities?.amounts || [];
      const titleLower = (item.title || "").toLowerCase();
      const ocrLower = (item.fullText || item.ocr_text || "").toLowerCase();
      if (amounts.length > 0) {
        intentMatchBoost += 0.85;
        matchReasons.push(`Matched Amount (${amounts[0]})`);
      } else if (titleLower.includes("price") || ocrLower.includes("price") || ocrLower.includes("rs") || ocrLower.includes("pkr")) {
        intentMatchBoost += 0.40;
        matchReasons.push("Matched Price keyword");
      }
    }

    // FlexSearch Boost
    if (this.flexIndex) {
      try {
        const flexHits = this.flexIndex.search(intent.rawQuery, { limit: 50 });
        const flexMatchedIds = new Set<string>();
        if (Array.isArray(flexHits)) {
          flexHits.forEach((h: any) => {
            if (h.result && Array.isArray(h.result)) {
              h.result.forEach((id: any) => flexMatchedIds.add(String(id)));
            } else if (typeof h === "string" || typeof h === "number") {
              flexMatchedIds.add(String(h));
            }
          });
        }
        if (flexMatchedIds.has(item.id)) {
          accumulatedWeightedScore += 1.5;
          matchReasons.push("FlexSearch Index Match");
        }
      } catch (e) {}
    }

    // Token Coverage Ratio
    const tokenCoverage = queryTokenCount > 0 ? matchedTokenCount / queryTokenCount : 0;
    if (matchedTokenCount > 0) {
      accumulatedWeightedScore += tokenCoverage * 2.5;
    }

    // Check exact phrase matching in OCR text
    const rawOcr = item.fullText || item.ocr_text || "";
    const rawOcrLower = rawOcr.toLowerCase();
    const cleanQueryLower = intent.cleanText.toLowerCase().trim();
    let hasExactOcrPhraseMatch = false;

    if (cleanQueryLower.length >= 3 && rawOcrLower.includes(cleanQueryLower)) {
      accumulatedWeightedScore += 4.5;
      hasExactOcrPhraseMatch = true;
      matchReasons.unshift(`Exact OCR Phrase: "${intent.cleanText}"`);
    }

    // If completely no match found across all tokens and intents, score is 0
    const rawTotalScore = accumulatedWeightedScore + intentMatchBoost;
    if (rawTotalScore <= 0 || (matchedTokenCount === 0 && intentMatchBoost === 0 && !hasExactOcrPhraseMatch)) {
      return {
        id: item.id,
        score: 0,
        matchReason: "No match",
        highlightSnippet: "",
      };
    }

    // Normalize final score [0.20 - 1.0] for valid matches
    const finalScore = Math.min(1.0, Math.max(0.20, Math.round((rawTotalScore / 6.0) * 100) / 100));

    // Extract contextual OCR snippet and matched tokens
    const ocrSnippetResult = extractMatchedOcrSnippet(rawOcr, cleanQueryTokens, 130);

    // Masked snippet for sensitive/private items to ensure no credentials or numbers leak in search preview
    let snippetText = ocrSnippetResult.snippet || item.summary || item.fullText?.slice(0, 140) || item.title;
    if (item.is_sensitive || item.isSensitive || item.privacy_level === "private" || item.privacy_level === "highly_sensitive") {
      snippetText = item.masked_ocr_text || item.maskedOcrText || item.summary || item.title;
    }
    const primaryReason =
      matchReasons.length > 0
        ? matchReasons.slice(0, 2).join(" • ")
        : `Matched keywords across Title, Category, OCR & Metadata`;

    const matchType: "exact" | "partial" | "fuzzy" | "ocr" | "semantic" | "metadata" = hasExactOcrPhraseMatch
      ? "exact"
      : ocrSnippetResult.matchedTerms.length > 0
      ? "ocr"
      : intentMatchBoost > 0
      ? "semantic"
      : "partial";

    return {
      id: item.id,
      score: finalScore,
      matchReason: primaryReason,
      highlightSnippet: snippetText,
      matchedOcrText: ocrSnippetResult.snippet,
      matchedTerms: ocrSnippetResult.matchedTerms,
      matchType,
    };
  }

  /**
   * Search Suggestions Engine
   */
  public getSuggestions(queryPrefix: string, items: ScreenshotItem[] = []): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const prefixLower = queryPrefix.toLowerCase().trim();

    // 1. Recent Search History
    const history = this.getSearchHistory();
    const historyMatches = history
      .filter((h) => !prefixLower || h.query.toLowerCase().includes(prefixLower))
      .slice(0, 3)
      .map((h) => ({
        text: h.query,
        type: "history" as const,
        category: h.categoryFilter,
      }));
    suggestions.push(...historyMatches);

    // 2. Popular Tags
    const tagCounts = new Map<string, number>();
    items.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        if (!prefixLower || tag.toLowerCase().includes(prefixLower)) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      });
    });

    const popularTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tag]) => ({
        text: tag,
        type: "tag" as const,
      }));

    suggestions.push(...popularTags);

    // 3. Categories
    const categories: CategoryType[] = [
      "Passport",
      "Electricity Bill",
      "Recipe",
      "QR Code",
      "Admission & Certificate",
      "E-Commerce",
      "Ticket & Travel",
      "Receipt & Invoice",
      "Financial",
      "Notes & Ideas",
    ];

    const categoryMatches = categories
      .filter((cat) => !prefixLower || cat.toLowerCase().includes(prefixLower))
      .slice(0, 3)
      .map((cat) => ({
        text: cat,
        type: "category" as const,
        category: cat,
      }));

    suggestions.push(...categoryMatches);

    const uniqueMap = new Map<string, SearchSuggestion>();
    suggestions.forEach((s) => {
      if (!uniqueMap.has(s.text.toLowerCase())) {
        uniqueMap.set(s.text.toLowerCase(), s);
      }
    });

    return Array.from(uniqueMap.values()).slice(0, 7);
  }

  private saveSearchHistory(query: string, resultCount: number, categoryFilter?: CategoryType): void {
    if (!query || query.trim().length < 2) return;
    try {
      const history = this.getSearchHistory();
      const filtered = history.filter((h) => h.query.toLowerCase() !== query.toLowerCase().trim());
      filtered.unshift({
        id: `sh_${Date.now()}`,
        query: query.trim(),
        timestamp: new Date().toISOString(),
        resultCount,
        categoryFilter,
      });
      saveSearchHistory(filtered.slice(0, 20));
    } catch (err) {
      console.warn("Failed to save search history:", err);
    }
  }

  public getSearchHistory(): Array<{
    id: string;
    query: string;
    timestamp: string;
    resultCount: number;
    categoryFilter?: CategoryType;
  }> {
    return loadSearchHistory();
  }

  public clearSearchHistory(): void {
    try {
      saveSearchHistory([]);
    } catch (err) {
      console.warn("Failed to clear search history:", err);
    }
  }

  public debugSearch(query: string, items?: ScreenshotItem[]): SearchResultMatch[] {
    const list = items || this.cachedItems || [];
    console.log(`[SearchEngine.debugSearch] Executing debug search for: "${query}" across ${list.length} items`);
    const results = this.search(query, list, { minScore: 0.05 });
    return results;
  }

  public findVisuallySimilar(
    referenceItem: ScreenshotItem,
    items?: ScreenshotItem[],
    limit: number = 10
  ): VisuallySimilarMatch[] {
    const list = items || this.cachedItems || [];
    return findVisuallySimilar(referenceItem, list, limit);
  }
}

export interface VisuallySimilarMatch {
  item: ScreenshotItem;
  similarityScore: number;
  matchReasons: string[];
}

export function findVisuallySimilar(
  referenceItem: ScreenshotItem,
  items: ScreenshotItem[],
  limit: number = 10
): VisuallySimilarMatch[] {
  if (!referenceItem || !items || items.length === 0) return [];

  const refHash = referenceItem.perceptual_hash || referenceItem.perceptualHash;
  const refColors = (referenceItem.colors || []).map((c) => c.toLowerCase());
  const refCategory = (referenceItem.category || "").toLowerCase();
  const refObjects = [...(referenceItem.objects || []), ...(referenceItem.objectsDetected || [])].map((o) => o.toLowerCase());
  const refSourceApp = (referenceItem.source_app || referenceItem.sourceApp || "").toLowerCase();

  const results: VisuallySimilarMatch[] = [];

  for (const candidate of items) {
    if (candidate.id === referenceItem.id) continue;
    if (!collectionSecurity.isItemAccessible(candidate)) continue;

    let score = 0;
    const reasons: string[] = [];

    // 1. Perceptual Hash Similarity (weight: 0.50)
    const candHash = candidate.perceptual_hash || candidate.perceptualHash;
    if (refHash && candHash && refHash !== "0000000000000000" && candHash !== "0000000000000000") {
      const pSim = calculatePerceptualSimilarity(refHash, candHash);
      if (pSim > 0.55) {
        score += pSim * 0.50;
        reasons.push(`${Math.round(pSim * 100)}% visual layout match`);
      }
    }

    // 2. Dominant Color Harmony (weight: 0.25)
    const candColors = (candidate.colors || []).map((c) => c.toLowerCase());
    if (refColors.length > 0 && candColors.length > 0) {
      const sharedColors = refColors.filter((rc) => candColors.some((cc) => cc.includes(rc) || rc.includes(cc)));
      if (sharedColors.length > 0) {
        const colorSim = sharedColors.length / Math.max(refColors.length, candColors.length);
        score += colorSim * 0.25;
        reasons.push(`Shared colors (${sharedColors.slice(0, 2).join(", ")})`);
      }
    }

    // 3. Category & Source App Match (weight: 0.15)
    const candCat = (candidate.category || "").toLowerCase();
    const candApp = (candidate.source_app || candidate.sourceApp || "").toLowerCase();
    if (refCategory && candCat && refCategory === candCat) {
      score += 0.12;
      reasons.push(`Same category (${candidate.category})`);
    }
    if (refSourceApp && candApp && refSourceApp === candApp) {
      score += 0.10;
      reasons.push(`Same app (${candidate.source_app || candidate.sourceApp})`);
    }

    // 4. Object & Concept Overlap (weight: 0.15)
    const candObjects = [...(candidate.objects || []), ...(candidate.objectsDetected || [])].map((o) => o.toLowerCase());
    if (refObjects.length > 0 && candObjects.length > 0) {
      const sharedObjects = refObjects.filter((ro) => candObjects.includes(ro));
      if (sharedObjects.length > 0) {
        score += 0.15;
        reasons.push(`Shared objects (${sharedObjects.slice(0, 2).join(", ")})`);
      }
    }

    if (score >= 0.12) {
      results.push({
        item: candidate,
        similarityScore: Math.min(1.0, score),
        matchReasons: reasons,
      });
    }
  }

  results.sort((a, b) => b.similarityScore - a.similarityScore);
  return results.slice(0, limit);
}

export const searchEngine = new SnapFindSearchEngine();
export const debugSearch = (query: string, items?: ScreenshotItem[]) => searchEngine.debugSearch(query, items);

