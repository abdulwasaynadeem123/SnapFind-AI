import { Capacitor } from '@capacitor/core';
import SnapFindMediaScanner, {
  ScreenshotDetectedPayload,
  ScanCompletedPayload,
  MediaScreenshotRecord,
} from '../plugins/SnapFindMediaScanner';
import { indexingEngine, CandidateImage } from './indexingEngine';
import { processingQueue } from './processingQueue';

export type GalleryPermissionState = 'prompt' | 'granted' | 'partial' | 'denied' | 'unsupported';

export interface PermissionStatus {
  granted: boolean;
  permissionState: GalleryPermissionState;
  isNativePlatform: boolean;
  isMonitoring: boolean;
  totalDiscoveredInScan: number;
  isScanningGallery: boolean;
  revokedNotice?: boolean;
}

type PermissionListener = (status: PermissionStatus) => void;

function buildDeterministicMediaId(item: MediaScreenshotRecord): string {
  if (item.mediaId && String(item.mediaId).trim().length > 0) {
    return `media_${String(item.mediaId).trim()}`;
  }
  const match = String(item.uri || '').match(/\/(\d+)(?:\?.*)?$/);
  if (match && match[1]) {
    return `media_${match[1]}`;
  }
  const cleanName = (item.filename || 'screenshot').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `media_${cleanName}_${item.dateAdded || 0}`;
}

function toCandidate(item: MediaScreenshotRecord, userId: string): CandidateImage {
  const modifiedSec = item.dateModified || item.dateAdded || 0;
  const modifiedMs = modifiedSec > 1e12 ? modifiedSec : modifiedSec * 1000;
  return {
    id: buildDeterministicMediaId(item),
    image_uri: item.uri,
    imageUrl: item.uri,
    file_name: item.filename || `screenshot_${modifiedSec || Date.now()}.png`,
    fileName: item.filename || `screenshot_${modifiedSec || Date.now()}.png`,
    folder: item.relativePath || 'Screenshots',
    date_modified: modifiedMs || Date.now(),
    dateModified: modifiedMs || Date.now(),
    file_size: item.size,
    userId,
    isModified: Boolean(item.isModified),
  };
}

class NativeMediaScannerService {
  private isInitialized = false;
  private isNativeOverride: boolean | null = null;
  private currentPermissionState: GalleryPermissionState = 'prompt';
  private isMonitoring = false;
  private isScanningGallery = false;
  private totalDiscoveredInScan = 0;
  private revokedNotice = false;
  private activeUserId: string | null = null;
  private permissionListeners: Set<PermissionListener> = new Set();
  private resumeListenerBound = false;

  public isNativeAndroid(): boolean {
    if (this.isNativeOverride !== null) return this.isNativeOverride;
    return Capacitor.isNativePlatform();
  }

  /** Test helper for deterministic native platform simulation in unit/integration tests. */
  public __setNativeOverrideForTest(val: boolean | null): void {
    this.isNativeOverride = val;
    this.isInitialized = false;
    this.isMonitoring = false;
    this.isScanningGallery = false;
    this.totalDiscoveredInScan = 0;
    this.revokedNotice = false;
    this.currentPermissionState = val === false ? 'unsupported' : 'prompt';
    this.notifyPermissionListeners();
  }

  public getPermissionStatus(): PermissionStatus {
    const isNative = this.isNativeAndroid();
    const state: GalleryPermissionState = isNative ? this.currentPermissionState : 'unsupported';
    return {
      granted: isNative && (state === 'granted' || state === 'partial'),
      permissionState: state,
      isNativePlatform: isNative,
      isMonitoring: this.isMonitoring,
      totalDiscoveredInScan: this.totalDiscoveredInScan,
      isScanningGallery: this.isScanningGallery,
      revokedNotice: this.revokedNotice,
    };
  }

  public subscribePermission(listener: PermissionListener): () => void {
    this.permissionListeners.add(listener);
    listener(this.getPermissionStatus());
    return () => this.permissionListeners.delete(listener);
  }

  private notifyPermissionListeners() {
    const status = this.getPermissionStatus();
    this.permissionListeners.forEach((fn) => {
      try {
        fn(status);
      } catch (err) {
        console.warn('[NativeMediaScanner] listener error:', err);
      }
    });
  }

  /**
   * Bind the authenticated user ID before scanning or monitoring.
   * Stops monitoring cleanly on logout so screenshots are never indexed without an active account.
   */
  public async setActiveUser(userId: string | null): Promise<void> {
    const normalized = userId && userId !== 'guest' && !userId.startsWith('local-guest') ? userId : null;
    if (this.activeUserId === normalized) return;
    this.activeUserId = normalized;

    if (!normalized) {
      await this.stopMonitoring();
      return;
    }

    if (!this.isNativeAndroid()) {
      this.currentPermissionState = 'unsupported';
      this.notifyPermissionListeners();
      return;
    }

    await this.initialize();
    const perm = await this.checkPermission();
    if (perm.granted) {
      await this.scanScreenshots();
      await this.startMonitoring();
    }
  }

  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  public async checkPermission(): Promise<PermissionStatus> {
    if (!this.isNativeAndroid()) {
      this.currentPermissionState = 'unsupported';
      this.isMonitoring = false;
      this.revokedNotice = false;
      this.notifyPermissionListeners();
      return this.getPermissionStatus();
    }

    const wasGranted =
      this.currentPermissionState === 'granted' || this.currentPermissionState === 'partial';

    try {
      const res = await SnapFindMediaScanner.checkGalleryPermission();
      const nextState = (res.permissionState || (res.granted ? 'granted' : 'prompt')) as GalleryPermissionState;
      this.currentPermissionState = nextState;

      const isNowGranted = nextState === 'granted' || nextState === 'partial';
      if (wasGranted && !isNowGranted) {
        await this.handlePermissionRevoked();
        return this.getPermissionStatus();
      }
      if (isNowGranted) {
        this.revokedNotice = false;
      }
      this.notifyPermissionListeners();
      return this.getPermissionStatus();
    } catch (err) {
      console.warn('[NativeMediaScanner] checkPermission error:', err);
      this.currentPermissionState = 'prompt';
      this.notifyPermissionListeners();
      return this.getPermissionStatus();
    }
  }

  public async requestPermission(): Promise<PermissionStatus> {
    if (!this.isNativeAndroid()) {
      // Never fake granted permissions on web browsers.
      this.currentPermissionState = 'unsupported';
      this.isMonitoring = false;
      this.notifyPermissionListeners();
      return this.getPermissionStatus();
    }

    try {
      const res = await SnapFindMediaScanner.requestGalleryPermission();
      const nextState = (res.permissionState || (res.granted ? 'granted' : 'denied')) as GalleryPermissionState;
      this.currentPermissionState = nextState;
      this.revokedNotice = false;
      this.notifyPermissionListeners();

      if (res.granted && (nextState === 'granted' || nextState === 'partial')) {
        await this.initialize();
        await this.scanScreenshots();
        await this.startMonitoring();
      } else {
        await this.stopMonitoring();
      }
      return this.getPermissionStatus();
    } catch (err) {
      console.error('[NativeMediaScanner] requestPermission error:', err);
      this.currentPermissionState = 'denied';
      this.notifyPermissionListeners();
      return this.getPermissionStatus();
    }
  }

  public async handlePermissionRevoked(): Promise<void> {
    this.currentPermissionState = 'denied';
    this.revokedNotice = true;
    await this.stopMonitoring();
    processingQueue.pauseQueue();
    this.notifyPermissionListeners();
  }

  public async openSettings(): Promise<void> {
    if (!this.isNativeAndroid()) return;
    try {
      await SnapFindMediaScanner.openAppSettings();
    } catch (err) {
      console.warn('[NativeMediaScanner] openAppSettings error:', err);
    }
  }

  public async scanScreenshots(forceFullScan: boolean = false): Promise<{ totalFound: number; enqueued: number; skipped: number }> {
    if (!this.isNativeAndroid()) {
      return { totalFound: 0, enqueued: 0, skipped: 0 };
    }

    try {
      const perm = await this.checkPermission();
      if (!perm.granted) {
        console.warn('[NativeMediaScanner] Skipping scanScreenshots: gallery permission not granted.');
        return { totalFound: 0, enqueued: 0, skipped: 0 };
      }

      if (!this.activeUserId) {
        console.warn('[NativeMediaScanner] Skipping scanScreenshots: waiting for authenticated user.');
        return { totalFound: 0, enqueued: 0, skipped: 0 };
      }

      this.isScanningGallery = true;
      this.notifyPermissionListeners();

      let sinceTimestamp = 0;
      if (!forceFullScan) {
        const lastScanIso = indexingEngine.getLastScanTimestamp(this.activeUserId);
        const parsed = new Date(lastScanIso).getTime();
        if (!isNaN(parsed) && parsed > 0) {
          sinceTimestamp = parsed;
        }
      }

      const scanRes = await SnapFindMediaScanner.scanExistingScreenshots({ sinceTimestamp });
      this.totalDiscoveredInScan = Math.max(this.totalDiscoveredInScan, scanRes.totalFound || 0);

      if (scanRes.lastScanTimestamp && scanRes.lastScanTimestamp > 0) {
        indexingEngine.setLastScanTimestamp(new Date(scanRes.lastScanTimestamp).toISOString(), this.activeUserId);
      }

      this.isScanningGallery = false;
      this.notifyPermissionListeners();
      return { totalFound: scanRes.totalFound || 0, enqueued: 0, skipped: 0 };
    } catch (err: any) {
      this.isScanningGallery = false;
      if (/permission|revoked/i.test(String(err?.message || ''))) {
        await this.handlePermissionRevoked();
      } else {
        this.notifyPermissionListeners();
      }
      console.error('[NativeMediaScanner] scanScreenshots error:', err);
      return { totalFound: 0, enqueued: 0, skipped: 0 };
    }
  }

  public async startMonitoring(): Promise<void> {
    if (!this.isNativeAndroid()) {
      this.isMonitoring = false;
      return;
    }
    if (!this.activeUserId) {
      return;
    }
    try {
      const perm = await this.checkPermission();
      if (!perm.granted) {
        this.isMonitoring = false;
        this.notifyPermissionListeners();
        return;
      }
      const res = await SnapFindMediaScanner.startScreenshotMonitoring();
      this.isMonitoring = Boolean(res?.active);
      this.notifyPermissionListeners();
    } catch (err: any) {
      this.isMonitoring = false;
      if (/permission|revoked/i.test(String(err?.message || ''))) {
        await this.handlePermissionRevoked();
      } else {
        this.notifyPermissionListeners();
      }
      console.warn('[NativeMediaScanner] startScreenshotMonitoring notice:', err);
    }
  }

  public async stopMonitoring(): Promise<void> {
    if (!this.isNativeAndroid()) {
      this.isMonitoring = false;
      return;
    }
    try {
      await SnapFindMediaScanner.stopScreenshotMonitoring();
    } catch {}
    this.isMonitoring = false;
    this.notifyPermissionListeners();
  }

  public async initialize(): Promise<void> {
    if (!this.isNativeAndroid()) {
      this.currentPermissionState = 'unsupported';
      this.isMonitoring = false;
      this.notifyPermissionListeners();
      return;
    }
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      const permRes = await this.checkPermission();

      // Re-check gallery permission whenever the user returns from Android Settings
      if (!this.resumeListenerBound && typeof window !== 'undefined') {
        this.resumeListenerBound = true;
        const handleReturnToApp = async () => {
          if (!this.isNativeAndroid()) return;
          const prevGranted =
            this.currentPermissionState === 'granted' || this.currentPermissionState === 'partial';
          const updated = await this.checkPermission();
          if (!prevGranted && updated.granted && this.activeUserId) {
            processingQueue.resumeQueue();
            await this.scanScreenshots();
            await this.startMonitoring();
          }
        };
        window.addEventListener('focus', handleReturnToApp);
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              handleReturnToApp();
            }
          });
        }
      }

      // Sync Android foreground notification progress with ProcessingQueue
      processingQueue.subscribe((jobs, activeJob) => {
        if (this.isNativeAndroid()) {
          if (activeJob) {
            SnapFindMediaScanner.updateNotificationProgress({
              progressPercentage: activeJob.progressPercent || 0,
            }).catch(() => {});
          } else {
            const hasQueued = jobs.some((j) => j.status === 'Queued');
            if (!hasQueued) {
              SnapFindMediaScanner.updateNotificationProgress({
                progressPercentage: -1,
              }).catch(() => {});
            }
          }
        }
      });

      // Listen for permission revocation from native plugin
      await SnapFindMediaScanner.addListener('onPermissionRevoked', () => {
        this.handlePermissionRevoked();
      });

      // Listen for newly created or modified screenshots detected by Android MediaStore ContentObserver
      await SnapFindMediaScanner.addListener('onScreenshotDetected', (data: ScreenshotDetectedPayload) => {
        if (!this.activeUserId || !this.getPermissionStatus().granted) return;
        const candidate = toCandidate(data, this.activeUserId);
        this.totalDiscoveredInScan += 1;
        indexingEngine.ingestScreenshotCandidate(candidate);
        this.notifyPermissionListeners();
      });

      // Listen for initial scan progress (tracks total discovered without double-enqueuing on completion)
      await SnapFindMediaScanner.addListener('onInitialScanProgress', (progress) => {
        if (!this.activeUserId || !this.getPermissionStatus().granted) return;
        if (typeof progress.total === 'number' && progress.total > this.totalDiscoveredInScan) {
          this.totalDiscoveredInScan = progress.total;
          this.notifyPermissionListeners();
        }
        if (progress.screenshot) {
          const candidate = toCandidate(progress.screenshot, this.activeUserId);
          indexingEngine.ingestScreenshotCandidate(candidate);
        }
      });

      // Listen for initial scan completed batch (deduplicated deterministically via mediaId)
      await SnapFindMediaScanner.addListener('onInitialScanCompleted', (data: ScanCompletedPayload) => {
        if (!this.activeUserId || !this.getPermissionStatus().granted) return;
        this.isScanningGallery = false;
        this.totalDiscoveredInScan = Math.max(this.totalDiscoveredInScan, data.totalFound || 0);
        if (data.lastScanTimestamp && data.lastScanTimestamp > 0) {
          indexingEngine.setLastScanTimestamp(new Date(data.lastScanTimestamp).toISOString(), this.activeUserId);
        }
        if (Array.isArray(data.screenshots) && data.screenshots.length > 0) {
          const candidates = data.screenshots.map((item) => toCandidate(item, this.activeUserId!));
          indexingEngine.ingestScreenshotCandidates(candidates);
        }
        this.notifyPermissionListeners();
      });

      if (permRes.granted && this.activeUserId) {
        await this.scanScreenshots();
        await this.startMonitoring();
      }
    } catch (err) {
      console.error('[NativeMediaScanner] Failed to initialize native media scanner:', err);
    }
  }
}

export const nativeMediaScanner = new NativeMediaScannerService();
