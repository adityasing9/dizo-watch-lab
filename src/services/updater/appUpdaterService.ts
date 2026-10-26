import { registerPlugin, Capacitor } from '@capacitor/core';

export interface GitHubReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  body: string;
  apkDownloadUrl: string;
  htmlUrl: string;
  isNewer: boolean;
}

interface AppUpdaterPluginInterface {
  installApk(options: { url: string }): Promise<{ success: boolean; filePath?: string }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (info: { progress: number; bytesDownloaded: number; totalBytes: number }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const AppUpdater = registerPlugin<AppUpdaterPluginInterface>('AppUpdater');

export const CURRENT_APP_VERSION = 'v1.7.0';

export async function checkGitHubRelease(): Promise<GitHubReleaseInfo | null> {
  try {
    const res = await fetch('https://api.github.com/repos/adityasing9/dizo-watch-lab/releases/latest', {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    const tagName = data.tag_name || '';
    const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
    const apkDownloadUrl =
      apkAsset?.browser_download_url ||
      `https://github.com/adityasing9/dizo-watch-lab/releases/download/${tagName}/dizo-watch-lab.apk`;

    // Compare versions
    const isNewer = compareVersions(tagName, CURRENT_APP_VERSION) > 0;

    return {
      tagName,
      name: data.name || tagName,
      publishedAt: data.published_at || '',
      body: data.body || '',
      apkDownloadUrl,
      htmlUrl: data.html_url || '',
      isNewer,
    };
  } catch (err) {
    console.warn('Failed to check GitHub releases:', err);
    return null;
  }
}

export async function performInAppUpdate(
  apkUrl: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; message?: string }> {
  if (Capacitor.isNativePlatform()) {
    let sub: { remove: () => Promise<void> } | null = null;
    try {
      if (onProgress) {
        sub = await AppUpdater.addListener('downloadProgress', (data) => {
          onProgress(data.progress);
        });
      }

      await AppUpdater.installApk({ url: apkUrl });
      return { success: true, message: 'Installer launched' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to update app in-place.' };
    } finally {
      if (sub) {
        try {
          await sub.remove();
        } catch {}
      }
    }
  } else {
    // Web fallback: Trigger browser download or service worker update
    window.open(apkUrl, '_blank');
    return { success: true, message: 'Downloading in browser' };
  }
}

/**
 * Semver-like comparator (returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal)
 */
function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/i, '').split('.').map(Number);
  const clean2 = v2.replace(/^v/i, '').split('.').map(Number);

  for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
