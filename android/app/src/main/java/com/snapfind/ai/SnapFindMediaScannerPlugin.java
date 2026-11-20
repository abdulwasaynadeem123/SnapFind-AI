package com.snapfind.ai;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@CapacitorPlugin(
    name = "SnapFindMediaScanner",
    permissions = {
        @Permission(
            alias = "images",
            strings = {
                Manifest.permission.READ_MEDIA_IMAGES
            }
        ),
        @Permission(
            alias = "selected_images",
            strings = {
                "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"
            }
        ),
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
        ),
        @Permission(
            alias = "notifications",
            strings = {
                "android.permission.POST_NOTIFICATIONS"
            }
        )
    }
)
public class SnapFindMediaScannerPlugin extends Plugin {

    private static final String TAG = "SnapFindMediaScanner";
    private static SnapFindMediaScannerPlugin activeInstance = null;
    private ContentObserver screenshotObserver = null;
    private static final int MAX_TRACKED_URIS = 10000;
    private static final Map<String, Long> processedVersions = Collections.synchronizedMap(
        new LinkedHashMap<String, Long>(256, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
                return size() > MAX_TRACKED_URIS;
            }
        }
    );

    public static boolean hasGalleryReadPermission(Context context) {
        if (context == null) return false;
        if (Build.VERSION.SDK_INT >= 34) {
            boolean full = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES)
                    == PackageManager.PERMISSION_GRANTED;
            boolean partial = ContextCompat.checkSelfPermission(context, "android.permission.READ_MEDIA_VISUAL_USER_SELECTED")
                    == PackageManager.PERMISSION_GRANTED;
            return full || partial;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasGalleryReadPermission() {
        if (Build.VERSION.SDK_INT >= 34) {
            return getPermissionState("images") == PermissionState.GRANTED
                    || getPermissionState("selected_images") == PermissionState.GRANTED;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return getPermissionState("images") == PermissionState.GRANTED;
        }
        return getPermissionState("storage") == PermissionState.GRANTED;
    }

    private enum VersionCheckResult {
        NEW,
        MODIFIED,
        UNCHANGED
    }

    private static VersionCheckResult checkAndTrackUriVersion(String uriStr, long dateModifiedSec) {
        synchronized (processedVersions) {
            Long prev = processedVersions.get(uriStr);
            if (prev == null) {
                processedVersions.put(uriStr, dateModifiedSec);
                return VersionCheckResult.NEW;
            }
            if (dateModifiedSec > prev) {
                processedVersions.put(uriStr, dateModifiedSec);
                return VersionCheckResult.MODIFIED;
            }
            return VersionCheckResult.UNCHANGED;
        }
    }

    private static boolean isScreenshotCandidate(String displayName, String pathOrRelative) {
        String nameLower = displayName != null ? displayName.toLowerCase(Locale.US) : "";
        String pathLower = pathOrRelative != null ? pathOrRelative.toLowerCase(Locale.US) : "";
        return nameLower.contains("screenshot")
                || nameLower.contains("screen_shot")
                || nameLower.contains("screen shot")
                || pathLower.contains("screenshots")
                || pathLower.contains("dcim/screenshots")
                || pathLower.contains("pictures/screenshots");
    }

    @Override
    public void load() {
        super.load();
        activeInstance = this;
    }

    @PluginMethod
    public void checkGalleryPermission(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = false;
        String state = "prompt";

        if (Build.VERSION.SDK_INT >= 34) {
            boolean hasFull = getPermissionState("images") == PermissionState.GRANTED;
            boolean hasPartial = getPermissionState("selected_images") == PermissionState.GRANTED;
            if (hasFull) {
                granted = true;
                state = "granted";
            } else if (hasPartial) {
                granted = true;
                state = "partial";
            } else {
                PermissionState s = getPermissionState("images");
                state = (s == PermissionState.DENIED) ? "denied" : "prompt";
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("images") == PermissionState.GRANTED) {
                granted = true;
                state = "granted";
            } else {
                PermissionState s = getPermissionState("images");
                state = (s == PermissionState.DENIED) ? "denied" : "prompt";
            }
        } else {
            if (getPermissionState("storage") == PermissionState.GRANTED) {
                granted = true;
                state = "granted";
            } else {
                PermissionState s = getPermissionState("storage");
                state = (s == PermissionState.DENIED) ? "denied" : "prompt";
            }
        }

        ret.put("granted", granted);
        ret.put("permissionState", state);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestGalleryPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            if (getPermissionState("images") == PermissionState.GRANTED) {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                ret.put("permissionState", "granted");
                call.resolve(ret);
            } else if (getPermissionState("selected_images") == PermissionState.GRANTED) {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                ret.put("permissionState", "partial");
                call.resolve(ret);
            } else {
                requestPermissionForAliases(new String[]{"images", "selected_images"}, call, "permissionCallback");
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("images") == PermissionState.GRANTED) {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                ret.put("permissionState", "granted");
                call.resolve(ret);
            } else {
                requestPermissionForAlias("images", call, "permissionCallback");
            }
        } else {
            if (getPermissionState("storage") == PermissionState.GRANTED) {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                ret.put("permissionState", "granted");
                call.resolve(ret);
            } else {
                requestPermissionForAlias("storage", call, "permissionCallback");
            }
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = false;
        String state = "denied";

        if (Build.VERSION.SDK_INT >= 34) {
            if (getPermissionState("images") == PermissionState.GRANTED) {
                granted = true;
                state = "granted";
            } else if (getPermissionState("selected_images") == PermissionState.GRANTED) {
                granted = true;
                state = "partial";
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("images") == PermissionState.GRANTED) {
                granted = true;
                state = "granted";
            }
        } else {
            if (getPermissionState("storage") == PermissionState.GRANTED) {
                granted = true;
                state = "granted";
            }
        }

        ret.put("granted", granted);
        ret.put("permissionState", state);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error opening app settings", e);
            call.reject("Failed to open app settings: " + e.getMessage());
        }
    }

    /**
     * Reads an Android MediaStore content:// URI safely via ContentResolver, downscales to
     * <= 1600px for OCR/AI and <= 320px for thumbnail, and returns base64 data URIs.
     */
    @PluginMethod
    public void readMediaAsBase64(PluginCall call) {
        if (!hasGalleryReadPermission()) {
            notifyPermissionRevoked();
            call.reject("Gallery permission is required to read screenshot data.");
            return;
        }
        String uriStr = call.getString("uri");
        if (uriStr == null || uriStr.trim().isEmpty()) {
            call.reject("A valid media URI is required.");
            return;
        }
        final int maxDimension = Math.max(320, Math.min(2048, call.getInt("maxDimension", 1600)));
        final int thumbMax = Math.max(120, Math.min(512, call.getInt("thumbnailMax", 320)));

        new Thread(() -> {
            try {
                Uri uri = Uri.parse(uriStr);
                ContentResolver resolver = getContext().getContentResolver();

                // 1. Decode bounds only to avoid OOM on large screenshots
                BitmapFactory.Options boundsOpts = new BitmapFactory.Options();
                boundsOpts.inJustDecodeBounds = true;
                try (InputStream boundsStream = resolver.openInputStream(uri)) {
                    if (boundsStream == null) {
                        call.reject("Unable to open image stream for URI.");
                        return;
                    }
                    BitmapFactory.decodeStream(boundsStream, null, boundsOpts);
                }

                int origWidth = boundsOpts.outWidth;
                int origHeight = boundsOpts.outHeight;
                if (origWidth <= 0 || origHeight <= 0) {
                    call.reject("Unable to decode image dimensions.");
                    return;
                }

                int sampleSize = 1;
                while ((origWidth / sampleSize) > maxDimension * 2 || (origHeight / sampleSize) > maxDimension * 2) {
                    sampleSize *= 2;
                }

                BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
                decodeOpts.inSampleSize = sampleSize;
                Bitmap decoded;
                try (InputStream decodeStream = resolver.openInputStream(uri)) {
                    if (decodeStream == null) {
                        call.reject("Unable to read image stream.");
                        return;
                    }
                    decoded = BitmapFactory.decodeStream(decodeStream, null, decodeOpts);
                }
                if (decoded == null) {
                    call.reject("Failed to decode screenshot bitmap.");
                    return;
                }

                Bitmap scaledMain = scaleDownBitmap(decoded, maxDimension);
                ByteArrayOutputStream mainOut = new ByteArrayOutputStream();
                scaledMain.compress(Bitmap.CompressFormat.JPEG, 86, mainOut);
                String mainBase64 = "data:image/jpeg;base64," + Base64.encodeToString(mainOut.toByteArray(), Base64.NO_WRAP);

                Bitmap thumbBitmap = scaleDownBitmap(scaledMain, thumbMax);
                ByteArrayOutputStream thumbOut = new ByteArrayOutputStream();
                thumbBitmap.compress(Bitmap.CompressFormat.JPEG, 78, thumbOut);
                String thumbBase64 = "data:image/jpeg;base64," + Base64.encodeToString(thumbOut.toByteArray(), Base64.NO_WRAP);

                int outWidth = scaledMain.getWidth();
                int outHeight = scaledMain.getHeight();
                if (thumbBitmap != scaledMain && !thumbBitmap.isRecycled()) thumbBitmap.recycle();
                if (scaledMain != decoded && !scaledMain.isRecycled()) scaledMain.recycle();
                if (!decoded.isRecycled()) decoded.recycle();

                JSObject res = new JSObject();
                res.put("base64Data", mainBase64);
                res.put("thumbnailData", thumbBase64);
                res.put("width", outWidth);
                res.put("height", outHeight);
                call.resolve(res);
            } catch (SecurityException secErr) {
                notifyPermissionRevoked();
                call.reject("Gallery permission was revoked.");
            } catch (Exception e) {
                Log.e(TAG, "Error reading media URI as base64", e);
                call.reject("Failed to read screenshot data: " + e.getMessage());
            }
        }).start();
    }

    private static Bitmap scaleDownBitmap(Bitmap source, int maxDim) {
        int width = source.getWidth();
        int height = source.getHeight();
        if (width <= maxDim && height <= maxDim) {
            return source;
        }
        float ratio = Math.min((float) maxDim / width, (float) maxDim / height);
        int targetW = Math.max(1, Math.round(width * ratio));
        int targetH = Math.max(1, Math.round(height * ratio));
        return Bitmap.createScaledBitmap(source, targetW, targetH, true);
    }

    @PluginMethod
    public void scanExistingScreenshots(PluginCall call) {
        if (!hasGalleryReadPermission()) {
            notifyPermissionRevoked();
            call.reject("Gallery permission is required to scan screenshots.");
            return;
        }
        long sinceTimestamp = call.hasOption("sinceTimestamp") ? call.getLong("sinceTimestamp") : 0L;

        getBridge().executeOnMainThread(() -> {
            new Thread(() -> {
                List<JSObject> screenshots = new ArrayList<>();
                ContentResolver resolver = getContext().getContentResolver();

                String pathCol = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? MediaStore.Images.Media.RELATIVE_PATH
                        : MediaStore.Images.Media.DATA;

                List<String> projectionList = new ArrayList<>();
                projectionList.add(MediaStore.Images.Media._ID);
                projectionList.add(MediaStore.Images.Media.DISPLAY_NAME);
                projectionList.add(MediaStore.Images.Media.DATE_ADDED);
                projectionList.add(MediaStore.Images.Media.DATE_MODIFIED);
                projectionList.add(MediaStore.Images.Media.WIDTH);
                projectionList.add(MediaStore.Images.Media.HEIGHT);
                projectionList.add(MediaStore.Images.Media.SIZE);
                projectionList.add(pathCol);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    projectionList.add(MediaStore.Images.Media.IS_PENDING);
                }
                String[] projection = projectionList.toArray(new String[0]);

                StringBuilder selectionBuilder = new StringBuilder();
                selectionBuilder.append("(");
                selectionBuilder.append(MediaStore.Images.Media.DISPLAY_NAME).append(" LIKE ? OR ");
                selectionBuilder.append(MediaStore.Images.Media.DISPLAY_NAME).append(" LIKE ? OR ");
                selectionBuilder.append(MediaStore.Images.Media.DISPLAY_NAME).append(" LIKE ? OR ");
                selectionBuilder.append(MediaStore.Images.Media.DISPLAY_NAME).append(" LIKE ? OR ");
                selectionBuilder.append(pathCol).append(" LIKE ? OR ");
                selectionBuilder.append(pathCol).append(" LIKE ?");
                selectionBuilder.append(") AND (");
                selectionBuilder.append(MediaStore.Images.Media.MIME_TYPE).append(" LIKE 'image/%'");
                selectionBuilder.append(")");

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    selectionBuilder.append(" AND (")
                            .append(MediaStore.Images.Media.IS_PENDING).append(" = 0 OR ")
                            .append(MediaStore.Images.Media.IS_PENDING).append(" IS NULL)");
                }

                List<String> argsList = new ArrayList<>();
                argsList.add("%Screenshot%");
                argsList.add("%screenshot%");
                argsList.add("%Screenshots%");
                argsList.add("%screen_shot%");
                argsList.add("%Screenshots%");
                argsList.add("%DCIM/Screenshots%");

                if (sinceTimestamp > 0) {
                    String sinceSec = String.valueOf(sinceTimestamp / 1000);
                    selectionBuilder.append(" AND (")
                            .append(MediaStore.Images.Media.DATE_ADDED).append(" > ? OR ")
                            .append(MediaStore.Images.Media.DATE_MODIFIED).append(" > ?)");
                    argsList.add(sinceSec);
                    argsList.add(sinceSec);
                }

                String selection = selectionBuilder.toString();
                String[] selectionArgs = argsList.toArray(new String[0]);
                String sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC";

                long maxTimestampMs = sinceTimestamp;

                try (Cursor cursor = resolver.query(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        projection,
                        selection,
                        selectionArgs,
                        sortOrder
                )) {
                    if (cursor != null) {
                        int total = cursor.getCount();
                        int scanned = 0;

                        int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                        int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                        int dateAddedCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED);
                        int dateModifiedCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_MODIFIED);
                        int widthColumn = cursor.getColumnIndex(MediaStore.Images.Media.WIDTH);
                        int heightColumn = cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT);
                        int sizeColumn = cursor.getColumnIndex(MediaStore.Images.Media.SIZE);
                        int pathColumn = cursor.getColumnIndex(pathCol);

                        while (cursor.moveToNext()) {
                            long id = cursor.getLong(idColumn);
                            String name = cursor.getString(nameColumn);
                            long dateAdded = cursor.getLong(dateAddedCol);
                            long dateModified = dateModifiedCol != -1 ? cursor.getLong(dateModifiedCol) : dateAdded;
                            long effectiveTsMs = Math.max(dateAdded, dateModified) * 1000L;
                            if (effectiveTsMs > maxTimestampMs) {
                                maxTimestampMs = effectiveTsMs;
                            }
                            int width = widthColumn != -1 ? cursor.getInt(widthColumn) : 0;
                            int height = heightColumn != -1 ? cursor.getInt(heightColumn) : 0;
                            long size = sizeColumn != -1 ? cursor.getLong(sizeColumn) : 0;
                            String relPath = pathColumn != -1 ? cursor.getString(pathColumn) : "Pictures/Screenshots";

                            Uri contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                            String uriStr = contentUri.toString();
                            VersionCheckResult versionStatus = checkAndTrackUriVersion(uriStr, Math.max(dateAdded, dateModified));

                            JSObject item = new JSObject();
                            item.put("mediaId", String.valueOf(id));
                            item.put("uri", uriStr);
                            item.put("filename", name);
                            item.put("dateAdded", dateAdded);
                            item.put("dateModified", dateModified);
                            item.put("width", width);
                            item.put("height", height);
                            item.put("size", size);
                            item.put("relativePath", relPath);
                            item.put("isModified", versionStatus == VersionCheckResult.MODIFIED);

                            screenshots.add(item);
                            scanned++;

                            JSObject progress = new JSObject();
                            progress.put("scanned", scanned);
                            progress.put("total", total);
                            progress.put("currentUri", uriStr);
                            progress.put("screenshot", item);
                            notifyListeners("onInitialScanProgress", progress);
                        }
                    }
                } catch (SecurityException secErr) {
                    Log.w(TAG, "Gallery permission revoked during scan", secErr);
                    notifyPermissionRevoked();
                    call.reject("Gallery permission was revoked during scanning.");
                    return;
                } catch (Exception e) {
                    Log.e(TAG, "Error scanning screenshots", e);
                }

                JSArray array = new JSArray();
                for (JSObject obj : screenshots) {
                    array.put(obj);
                }

                JSObject completedPayload = new JSObject();
                completedPayload.put("totalFound", screenshots.size());
                completedPayload.put("lastScanTimestamp", maxTimestampMs);
                completedPayload.put("screenshots", array);
                notifyListeners("onInitialScanCompleted", completedPayload);

                JSObject res = new JSObject();
                res.put("totalFound", screenshots.size());
                res.put("lastScanTimestamp", maxTimestampMs);
                call.resolve(res);
            }).start();
        });
    }

    @PluginMethod
    public void startScreenshotMonitoring(PluginCall call) {
        if (!hasGalleryReadPermission()) {
            notifyPermissionRevoked();
            call.reject("Gallery permission is required to monitor screenshots.");
            return;
        }
        Context context = getContext();

        // 1. Start ForegroundService for ongoing notification and persistent ContentObserver
        try {
            Intent serviceIntent = new Intent(context, ScreenshotForegroundService.class);
            serviceIntent.setAction(ScreenshotForegroundService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start ScreenshotForegroundService:", e);
        }

        // 2. Schedule WorkManager periodic task with constraints (batteryNotLow = true)
        try {
            ScreenshotWorker.schedulePeriodicWork(context);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule WorkManager task:", e);
        }

        // 3. Register plugin ContentObserver if not active
        if (screenshotObserver == null) {
            Handler handler = new Handler(Looper.getMainLooper());
            screenshotObserver = new ContentObserver(handler) {
                @Override
                public void onChange(boolean selfChange, Uri uri) {
                    super.onChange(selfChange, uri);
                    if (!hasGalleryReadPermission()) {
                        notifyPermissionRevoked();
                        return;
                    }
                    if (uri != null) {
                        checkAndNotifyNewScreenshot(uri);
                    } else {
                        checkLatestScreenshot();
                    }
                }
            };

            getContext().getContentResolver().registerContentObserver(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    true,
                    screenshotObserver
            );
        }

        JSObject res = new JSObject();
        res.put("active", true);
        call.resolve(res);
    }

    @PluginMethod
    public void stopScreenshotMonitoring(PluginCall call) {
        stopMonitoringInternal();
        JSObject res = new JSObject();
        res.put("active", false);
        call.resolve(res);
    }

    private void stopMonitoringInternal() {
        if (screenshotObserver != null) {
            try {
                getContext().getContentResolver().unregisterContentObserver(screenshotObserver);
            } catch (Exception e) {
                Log.w(TAG, "Error unregistering ContentObserver:", e);
            }
            screenshotObserver = null;
        }

        Context context = getContext();
        if (context != null) {
            try {
                Intent serviceIntent = new Intent(context, ScreenshotForegroundService.class);
                serviceIntent.setAction(ScreenshotForegroundService.ACTION_STOP);
                context.stopService(serviceIntent);
            } catch (Exception e) {
                Log.e(TAG, "Error stopping ScreenshotForegroundService:", e);
            }
        }
    }

    private void notifyPermissionRevoked() {
        stopMonitoringInternal();
        JSObject payload = new JSObject();
        payload.put("granted", false);
        payload.put("permissionState", "denied");
        notifyListeners("onPermissionRevoked", payload);
    }

    @PluginMethod
    public void updateNotificationProgress(PluginCall call) {
        int progress = call.getInt("progressPercentage", -1);
        Context context = getContext();
        try {
            Intent intent = new Intent(context, ScreenshotForegroundService.class);
            intent.setAction(ScreenshotForegroundService.ACTION_UPDATE_PROGRESS);
            intent.putExtra(ScreenshotForegroundService.EXTRA_PROGRESS, progress);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error updating notification progress:", e);
            call.reject("Failed to update notification progress", e);
        }
    }

    public static void handleNativeScreenshotDetected(Context context, Uri uri) {
        if (!hasGalleryReadPermission(context)) {
            if (activeInstance != null) {
                activeInstance.notifyPermissionRevoked();
            }
            return;
        }
        if (activeInstance != null) {
            if (uri != null) {
                activeInstance.checkAndNotifyNewScreenshot(uri);
            } else {
                activeInstance.checkLatestScreenshot();
            }
        }
    }

    private void checkAndNotifyNewScreenshot(Uri uri) {
        if (!hasGalleryReadPermission()) {
            notifyPermissionRevoked();
            return;
        }
        new Thread(() -> {
            try {
                ContentResolver resolver = getContext().getContentResolver();
                String pathCol = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? MediaStore.Images.Media.RELATIVE_PATH
                        : MediaStore.Images.Media.DATA;

                List<String> proj = new ArrayList<>();
                proj.add(MediaStore.Images.Media._ID);
                proj.add(MediaStore.Images.Media.DISPLAY_NAME);
                proj.add(MediaStore.Images.Media.DATE_ADDED);
                proj.add(MediaStore.Images.Media.DATE_MODIFIED);
                proj.add(MediaStore.Images.Media.WIDTH);
                proj.add(MediaStore.Images.Media.HEIGHT);
                proj.add(MediaStore.Images.Media.SIZE);
                proj.add(pathCol);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    proj.add(MediaStore.Images.Media.IS_PENDING);
                }

                try (Cursor cursor = resolver.query(uri, proj.toArray(new String[0]), null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            int pendingCol = cursor.getColumnIndex(MediaStore.Images.Media.IS_PENDING);
                            if (pendingCol != -1 && cursor.getInt(pendingCol) == 1) {
                                // Still being written by system screenshot tool; wait for final MediaStore update
                                return;
                            }
                        }

                        long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
                        String name = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME));
                        long dateAdded = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED));
                        int modCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_MODIFIED);
                        long dateModified = modCol != -1 ? cursor.getLong(modCol) : dateAdded;
                        int pathIdx = cursor.getColumnIndex(pathCol);
                        String relPath = pathIdx != -1 ? cursor.getString(pathIdx) : "";
                        int wIdx = cursor.getColumnIndex(MediaStore.Images.Media.WIDTH);
                        int hIdx = cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT);
                        int sIdx = cursor.getColumnIndex(MediaStore.Images.Media.SIZE);

                        if (isScreenshotCandidate(name, relPath)) {
                            Uri contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                            String uriStr = contentUri.toString();
                            VersionCheckResult status = checkAndTrackUriVersion(uriStr, Math.max(dateAdded, dateModified));

                            if (status == VersionCheckResult.NEW || status == VersionCheckResult.MODIFIED) {
                                JSObject item = new JSObject();
                                item.put("mediaId", String.valueOf(id));
                                item.put("uri", uriStr);
                                item.put("filename", name);
                                item.put("dateAdded", dateAdded);
                                item.put("dateModified", dateModified);
                                item.put("width", wIdx != -1 ? cursor.getInt(wIdx) : 0);
                                item.put("height", hIdx != -1 ? cursor.getInt(hIdx) : 0);
                                item.put("size", sIdx != -1 ? cursor.getLong(sIdx) : 0);
                                item.put("relativePath", relPath);
                                item.put("isModified", status == VersionCheckResult.MODIFIED);

                                notifyListeners("onScreenshotDetected", item);
                            }
                        }
                    }
                }
            } catch (SecurityException secErr) {
                notifyPermissionRevoked();
            } catch (Exception e) {
                Log.e(TAG, "Error processing newly detected image URI", e);
            }
        }).start();
    }

    private void checkLatestScreenshot() {
        if (!hasGalleryReadPermission()) {
            notifyPermissionRevoked();
            return;
        }
        new Thread(() -> {
            try {
                ContentResolver resolver = getContext().getContentResolver();
                String pathCol = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? MediaStore.Images.Media.RELATIVE_PATH
                        : MediaStore.Images.Media.DATA;

                List<String> proj = new ArrayList<>();
                proj.add(MediaStore.Images.Media._ID);
                proj.add(MediaStore.Images.Media.DISPLAY_NAME);
                proj.add(MediaStore.Images.Media.DATE_ADDED);
                proj.add(MediaStore.Images.Media.DATE_MODIFIED);
                proj.add(MediaStore.Images.Media.WIDTH);
                proj.add(MediaStore.Images.Media.HEIGHT);
                proj.add(MediaStore.Images.Media.SIZE);
                proj.add(pathCol);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    proj.add(MediaStore.Images.Media.IS_PENDING);
                }

                String selection = "(" + MediaStore.Images.Media.DISPLAY_NAME + " LIKE ? OR "
                        + MediaStore.Images.Media.DISPLAY_NAME + " LIKE ? OR "
                        + pathCol + " LIKE ?)";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    selection += " AND (" + MediaStore.Images.Media.IS_PENDING + " = 0 OR "
                            + MediaStore.Images.Media.IS_PENDING + " IS NULL)";
                }
                String[] selectionArgs = new String[]{"%Screenshot%", "%screenshot%", "%Screenshots%"};
                // Android 11+ (API 30+) forbids raw "LIMIT 1" inside sortOrder; read cursor.moveToFirst() instead
                String sortOrder = MediaStore.Images.Media.DATE_MODIFIED + " DESC, " + MediaStore.Images.Media.DATE_ADDED + " DESC";

                try (Cursor cursor = resolver.query(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                        proj.toArray(new String[0]),
                        selection,
                        selectionArgs,
                        sortOrder
                )) {
                    if (cursor != null && cursor.moveToFirst()) {
                        long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID));
                        String name = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME));
                        long dateAdded = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED));
                        int modCol = cursor.getColumnIndex(MediaStore.Images.Media.DATE_MODIFIED);
                        long dateModified = modCol != -1 ? cursor.getLong(modCol) : dateAdded;
                        int pathIdx = cursor.getColumnIndex(pathCol);
                        String relPath = pathIdx != -1 ? cursor.getString(pathIdx) : "";
                        int wIdx = cursor.getColumnIndex(MediaStore.Images.Media.WIDTH);
                        int hIdx = cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT);
                        int sIdx = cursor.getColumnIndex(MediaStore.Images.Media.SIZE);

                        Uri contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                        String uriStr = contentUri.toString();
                        VersionCheckResult status = checkAndTrackUriVersion(uriStr, Math.max(dateAdded, dateModified));

                        if (status == VersionCheckResult.NEW || status == VersionCheckResult.MODIFIED) {
                            JSObject item = new JSObject();
                            item.put("mediaId", String.valueOf(id));
                            item.put("uri", uriStr);
                            item.put("filename", name);
                            item.put("dateAdded", dateAdded);
                            item.put("dateModified", dateModified);
                            item.put("width", wIdx != -1 ? cursor.getInt(wIdx) : 0);
                            item.put("height", hIdx != -1 ? cursor.getInt(hIdx) : 0);
                            item.put("size", sIdx != -1 ? cursor.getLong(sIdx) : 0);
                            item.put("relativePath", relPath);
                            item.put("isModified", status == VersionCheckResult.MODIFIED);

                            notifyListeners("onScreenshotDetected", item);
                        }
                    }
                }
            } catch (SecurityException secErr) {
                notifyPermissionRevoked();
            } catch (Exception e) {
                Log.e(TAG, "Error checking latest screenshot", e);
            }
        }).start();
    }
}
