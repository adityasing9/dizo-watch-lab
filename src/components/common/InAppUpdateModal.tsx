import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import {
  checkGitHubRelease,
  performInAppUpdate,
  CURRENT_APP_VERSION,
  GitHubReleaseInfo,
} from '../../services/updater/appUpdaterService';
import {
  Download,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

interface InAppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InAppUpdateModal: React.FC<InAppUpdateModalProps> = ({ isOpen, onClose }) => {
  const [releaseInfo, setReleaseInfo] = useState<GitHubReleaseInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      handleCheck();
    }
  }, [isOpen]);

  const handleCheck = async () => {
    setIsChecking(true);
    setUpdateError(null);
    try {
      const info = await checkGitHubRelease();
      setReleaseInfo(info);
    } catch (err: any) {
      setUpdateError('Could not reach GitHub release server.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleStartUpdate = async () => {
    if (!releaseInfo) return;
    setIsUpdating(true);
    setUpdateProgress(0);
    setUpdateError(null);

    try {
      const result = await performInAppUpdate(releaseInfo.apkDownloadUrl, (percent) => {
        setUpdateProgress(percent);
      });

      if (result.success) {
        setUpdateSuccess(true);
      } else {
        setUpdateError(result.message || 'Update failed.');
      }
    } catch (err: any) {
      setUpdateError(err.message || 'An error occurred during update.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="In-App Direct Updater" maxWidth="md">
      <div className="space-y-4 font-mono text-xs">
        {/* Version Status Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span>Installed App Version:</span>
            <span className="font-bold text-yellow-400 bg-yellow-950/80 px-2 py-0.5 rounded border border-yellow-800">
              {CURRENT_APP_VERSION}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
            <span>Latest GitHub Release:</span>
            {isChecking ? (
              <span className="text-slate-500 animate-pulse">Checking...</span>
            ) : releaseInfo ? (
              <span className={`font-bold ${releaseInfo.isNewer ? 'text-emerald-400' : 'text-slate-300'}`}>
                {releaseInfo.tagName} {releaseInfo.isNewer && '(Newer)'}
              </span>
            ) : (
              <span className="text-slate-500">Unknown</span>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {releaseInfo && !releaseInfo.isNewer && !isChecking && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>You have the latest version installed ({CURRENT_APP_VERSION}).</span>
          </div>
        )}

        {releaseInfo && releaseInfo.isNewer && (
          <div className="p-3.5 bg-yellow-950/40 border border-yellow-700/80 rounded-xl text-yellow-200 text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-yellow-300">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Update Ready: {releaseInfo.tagName}</span>
            </div>
            <p className="leading-relaxed text-slate-300">
              {releaseInfo.name} is available. Tap the button below to download and update directly without leaving the app!
            </p>
          </div>
        )}

        {/* Progress Bar when Updating */}
        {isUpdating && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-slate-300 text-[11px]">
              <span>Downloading update package directly...</span>
              <span className="text-yellow-400 font-bold">{updateProgress}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden p-0.5">
              <div
                className="bg-yellow-400 h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.max(5, updateProgress)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Please wait while the update downloads. The system package installer will launch automatically.
            </p>
          </div>
        )}

        {/* Success Prompt */}
        {updateSuccess && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-300">
              <Smartphone className="w-4 h-4" />
              <span>Installer Launched</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              Android has opened the system installer. Tap <strong>&quot;Update&quot;</strong> on your screen to complete the in-place update!
            </p>
          </div>
        )}

        {/* Error message */}
        {updateError && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-300">
              <AlertTriangle className="w-4 h-4" />
              <span>Update Notice</span>
            </div>
            <p className="leading-relaxed">{updateError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={handleCheck}
            disabled={isChecking || isUpdating}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-yellow-400' : ''}`} />
            <span>Check for Updates</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isUpdating}
              className="w-1/2 sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
            >
              Close
            </button>

            <button
              onClick={handleStartUpdate}
              disabled={isUpdating || isChecking}
              className="w-1/2 sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-950 font-mono text-xs font-bold transition-all shadow-md"
            >
              <Download className={`w-4 h-4 ${isUpdating ? 'animate-bounce' : ''}`} />
              <span>{isUpdating ? 'Updating...' : 'Update Directly In-App'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
