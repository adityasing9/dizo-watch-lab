package com.dizo.watchlab;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void installApk(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            InputStream in = null;
            FileOutputStream out = null;

            try {
                Context context = getContext();
                File downloadDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (downloadDir == null) {
                    downloadDir = context.getCacheDir();
                }
                if (!downloadDir.exists()) {
                    downloadDir.mkdirs();
                }

                File apkFile = new File(downloadDir, "dizo-update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                URL url = new URL(urlString);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.connect();

                // Follow redirects if returned 301/302/307/308
                int status = conn.getResponseCode();
                int redirects = 0;
                while ((status == HttpURLConnection.HTTP_MOVED_TEMP ||
                        status == HttpURLConnection.HTTP_MOVED_PERM ||
                        status == HttpURLConnection.HTTP_SEE_OTHER ||
                        status == 307 || status == 308) && redirects < 5) {
                    String newUrl = conn.getHeaderField("Location");
                    conn.disconnect();
                    url = new URL(newUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.connect();
                    status = conn.getResponseCode();
                    redirects++;
                }

                if (status != HttpURLConnection.HTTP_OK) {
                    call.reject("Download server returned status HTTP " + status);
                    return;
                }

                int contentLength = conn.getContentLength();
                in = conn.getInputStream();
                out = new FileOutputStream(apkFile);

                byte[] buffer = new byte[16384];
                int bytesRead;
                long totalBytesRead = 0;
                long lastProgressTime = 0;

                while ((bytesRead = in.read(buffer)) != -1) {
                    out.write(buffer, 0, bytesRead);
                    totalBytesRead += bytesRead;

                    long now = System.currentTimeMillis();
                    if (contentLength > 0 && (now - lastProgressTime > 150)) {
                        lastProgressTime = now;
                        int progress = (int) ((totalBytesRead * 100) / contentLength);
                        JSObject progressObj = new JSObject();
                        progressObj.put("progress", progress);
                        progressObj.put("bytesDownloaded", totalBytesRead);
                        progressObj.put("totalBytes", contentLength);
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                out.flush();
                out.close();
                out = null;
                in.close();
                in = null;
                conn.disconnect();
                conn = null;

                // Send 100% progress
                JSObject finalProgress = new JSObject();
                finalProgress.put("progress", 100);
                finalProgress.put("bytesDownloaded", totalBytesRead);
                finalProgress.put("totalBytes", totalBytesRead);
                notifyListeners("downloadProgress", finalProgress);

                // Launch package installer using FileProvider
                Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apkFile);

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                context.startActivity(intent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("filePath", apkFile.getAbsolutePath());
                call.resolve(ret);

            } catch (Exception e) {
                call.reject("In-app update failed: " + e.getMessage(), e);
            } finally {
                try { if (out != null) out.close(); } catch (Exception ignored) {}
                try { if (in != null) in.close(); } catch (Exception ignored) {}
                try { if (conn != null) conn.disconnect(); } catch (Exception ignored) {}
            }
        }).start();
    }
}
