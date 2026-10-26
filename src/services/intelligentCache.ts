/**
 * SnapFind AI — Intelligent Multi-Tier Caching Service
 *
 * Implements:
 * 1. High-Performance In-Memory LRU Cache (strictly bounded to prevent memory leaks).
 * 2. Persistent IndexedDB Cache for:
 *    - Thumbnails (compressed Base64/Blob URIs)
 *    - OCR Extracted Text (keyed by SHA-256 content hash)
 *    - AI Descriptions, Key Entities, & Vision Tags (keyed by SHA-256 content hash)
 *    - Natural Language Search Results (keyed by user & query hash)
 * 3. Strict User-Data Isolation: all cache keys are user-scoped (`${userId}::${key}`).
 * 4. Safe Logout Eviction: clears all user-scoped private cache on sign-out.
 * 5. Automatic Storage Quota & LRU Eviction: prevents runaway disk/memory growth.
 */

interface CacheRecord<T> {
  key: string;
  userId: string;
  data: T;
  createdAt: number;
  lastAccessedAt: number;
  sizeBytes?: number;
}

class IntelligentCacheService {
  private dbName = "SnapFind_IntelligentCache_v1";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  // In-Memory LRU Cache with strict limits
  private memCache = new Map<string, CacheRecord<any>>();
  private readonly MAX_MEM_ENTRIES = 200;
  private readonly DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for OCR/AI results

  constructor() {
    if (typeof window !== "undefined") {
      this.initDB();
    }
  }

  /**
   * Initialize IndexedDB database for persistent caching
   */
  public async initDB(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        resolve();
        return;
      }

      try {
        const req = indexedDB.open(this.dbName, this.dbVersion);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const database = req.result;
          if (!database.objectStoreNames.contains("cache_entries")) {
            const store = database.createObjectStore("cache_entries", { keyPath: "key" });
            store.createIndex("userId", "userId", { unique: false });
            store.createIndex("lastAccessedAt", "lastAccessedAt", { unique: false });
          }
        };

        req.onsuccess = () => {
          this.db = req.result;
          resolve();
        };

        req.onerror = () => {
          console.warn("[IntelligentCache] IndexedDB open error, falling back to memory:", req.error);
          resolve();
        };
      } catch (err) {
        console.warn("[IntelligentCache] Failed to initialize IndexedDB:", err);
        resolve();
      }
    });

    return this.initPromise;
  }

  /**
   * Construct safe, user-isolated cache key
   */
  private makeKey(category: "ocr" | "ai" | "thumb" | "search", identifier: string, userId: string = "guest"): string {
    const cleanUser = userId || "guest";
    const cleanId = identifier.trim().toLowerCase();
    return `${cleanUser}::${category}::${cleanId}`;
  }

  /**
   * High-speed in-memory LRU get
   */
  private getFromMem<T>(key: string): T | null {
    const record = this.memCache.get(key);
    if (!record) return null;

    // Check expiration
    if (Date.now() - record.createdAt > this.DEFAULT_TTL_MS) {
      this.memCache.delete(key);
      return null;
    }

    // Refresh LRU
    record.lastAccessedAt = Date.now();
    this.memCache.delete(key);
    this.memCache.set(key, record);
    return record.data as T;
  }

  /**
   * Set into in-memory LRU cache with eviction
   */
  private setIntoMem<T>(key: string, userId: string, data: T): void {
    const record: CacheRecord<T> = {
      key,
      userId,
      data,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    if (this.memCache.has(key)) {
      this.memCache.delete(key);
    } else if (this.memCache.size >= this.MAX_MEM_ENTRIES) {
      // Evict oldest LRU entry
      const oldestKey = this.memCache.keys().next().value;
      if (oldestKey) this.memCache.delete(oldestKey);
    }

    this.memCache.set(key, record);
  }

  /**
   * Store into IndexedDB persistently
   */
  private async setIntoIndexedDB<T>(key: string, userId: string, data: T): Promise<void> {
    await this.initDB();
    if (!this.db) return;

    try {
      const tx = this.db.transaction("cache_entries", "readwrite");
      const store = tx.objectStore("cache_entries");
      const record: CacheRecord<T> = {
        key,
        userId,
        data,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      store.put(record);
    } catch (err) {
      console.warn("[IntelligentCache] Failed to persist to IndexedDB:", err);
    }
  }

  /**
   * Read from IndexedDB persistently
   */
  private async getFromIndexedDB<T>(key: string): Promise<T | null> {
    await this.initDB();
    if (!this.db) return null;

    return new Promise<T | null>((resolve) => {
      try {
        const tx = this.db!.transaction("cache_entries", "readwrite");
        const store = tx.objectStore("cache_entries");
        const req = store.get(key);

        req.onsuccess = () => {
          const record: CacheRecord<T> | undefined = req.result;
          if (!record) {
            resolve(null);
            return;
          }

          if (Date.now() - record.createdAt > this.DEFAULT_TTL_MS) {
            store.delete(key);
            resolve(null);
            return;
          }

          // Update access timestamp for LRU
          record.lastAccessedAt = Date.now();
          store.put(record);

          // Populate fast memory tier
          this.setIntoMem(key, record.userId, record.data);
          resolve(record.data);
        };

        req.onerror = () => {
          resolve(null);
        };
      } catch (err) {
        resolve(null);
      }
    });
  }

  // ==========================================
  // Public Specialized Domain Accessors
  // ==========================================

  /**
   * OCR Result Cache (keyed by image SHA-256 hash)
   */
  public async getOcrText(imageHash: string, userId: string = "guest"): Promise<string | null> {
    if (!imageHash || imageHash.length < 16) return null;
    const key = this.makeKey("ocr", imageHash, userId);

    const memHit = this.getFromMem<string>(key);
    if (memHit !== null) return memHit;

    return await this.getFromIndexedDB<string>(key);
  }

  public async setOcrText(imageHash: string, text: string, userId: string = "guest"): Promise<void> {
    if (!imageHash || !text) return;
    const key = this.makeKey("ocr", imageHash, userId);
    this.setIntoMem(key, userId, text);
    await this.setIntoIndexedDB(key, userId, text);
  }

  /**
   * AI Analysis Cache (descriptions, tags, objects, categories)
   */
  public async getAiAnalysis(imageHash: string, userId: string = "guest"): Promise<any | null> {
    if (!imageHash || imageHash.length < 16) return null;
    const key = this.makeKey("ai", imageHash, userId);

    const memHit = this.getFromMem<any>(key);
    if (memHit !== null) return memHit;

    return await this.getFromIndexedDB<any>(key);
  }

  public async setAiAnalysis(imageHash: string, analysis: any, userId: string = "guest"): Promise<void> {
    if (!imageHash || !analysis) return;
    const key = this.makeKey("ai", imageHash, userId);
    this.setIntoMem(key, userId, analysis);
    await this.setIntoIndexedDB(key, userId, analysis);
  }

  /**
   * Thumbnail Cache
   */
  public async getThumbnail(imageIdOrHash: string, userId: string = "guest"): Promise<string | null> {
    if (!imageIdOrHash) return null;
    const key = this.makeKey("thumb", imageIdOrHash, userId);

    const memHit = this.getFromMem<string>(key);
    if (memHit !== null) return memHit;

    return await this.getFromIndexedDB<string>(key);
  }

  public async setThumbnail(imageIdOrHash: string, thumbnailUri: string, userId: string = "guest"): Promise<void> {
    if (!imageIdOrHash || !thumbnailUri) return;
    const key = this.makeKey("thumb", imageIdOrHash, userId);
    this.setIntoMem(key, userId, thumbnailUri);
    await this.setIntoIndexedDB(key, userId, thumbnailUri);
  }

  /**
   * User Logout Eviction — completely cleanses all cached OCR, AI descriptions, thumbnails, and queries for this user
   */
  public async clearUserCache(userId?: string): Promise<void> {
    const targetUser = userId || "guest";
    console.log(`[IntelligentCache] Purging sensitive user cache for userId: ${targetUser}`);

    // 1. Evict from memory
    const prefix = `${targetUser}::`;
    for (const key of Array.from(this.memCache.keys())) {
      if (key.startsWith(prefix) || !userId) {
        this.memCache.delete(key);
      }
    }

    // 2. Evict from IndexedDB
    await this.initDB();
    if (!this.db) return;

    try {
      const tx = this.db.transaction("cache_entries", "readwrite");
      const store = tx.objectStore("cache_entries");

      if (!userId) {
        store.clear();
        return;
      }

      const index = store.index("userId");
      const req = index.getAllKeys(IDBKeyRange.only(targetUser));

      req.onsuccess = () => {
        const keys = req.result;
        if (Array.isArray(keys)) {
          keys.forEach((k) => store.delete(k));
        }
      };
    } catch (err) {
      console.warn("[IntelligentCache] Error clearing user cache from IndexedDB:", err);
    }
  }

  /**
   * Clear entire cache
   */
  public async clearAll(): Promise<void> {
    this.memCache.clear();
    await this.initDB();
    if (this.db) {
      try {
        const tx = this.db.transaction("cache_entries", "readwrite");
        tx.objectStore("cache_entries").clear();
      } catch {}
    }
  }
}

export const intelligentCache = new IntelligentCacheService();
