import React, { useState, useEffect } from 'react';
import { Sparkles, Download, RefreshCw, X, ArrowUpCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function UpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [initialBuildTime, setInitialBuildTime] = useState<number | null>(null);

  // 1. Listen for Service Worker update event
  useEffect(() => {
    const handleSwUpdate = () => {
      console.log('🚀 [UpdateManager] Service Worker reported new version available!');
      setUpdateAvailable(true);
    };

    window.addEventListener('zoyo-update-available', handleSwUpdate);
    return () => window.removeEventListener('zoyo-update-available', handleSwUpdate);
  }, []);

  // 2. Poll server /api/version periodically (every 45s) to detect updates automatically
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version');
        if (res.ok) {
          const data = await res.json();
          if (data && data.buildTime) {
            if (initialBuildTime === null) {
              setInitialBuildTime(data.buildTime);
              setUpdateVersion(data.version || '1.0.0');
            } else if (data.buildTime !== initialBuildTime) {
              console.log('🚀 [UpdateManager] New server build detected:', data.buildTime);
              setUpdateVersion(data.version || '1.0.0');
              setUpdateAvailable(true);
            }
          }
        }
      } catch {
        // network silent
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 45000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [initialBuildTime]);

  // 3. Listen for PWA mobile install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Only show install banner if user hasn't dismissed it this session
      try {
        if (!sessionStorage.getItem('zoyo_install_dismissed')) {
          setShowInstallBanner(true);
        }
      } catch {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleApplyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.update());
      });
    }
    // Hard reload to get newest files
    window.location.reload();
  };

  const handleTriggerInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      console.log('✅ User accepted PWA install');
    }
    setInstallPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissInstall = () => {
    try {
      sessionStorage.setItem('zoyo_install_dismissed', 'true');
    } catch {}
    setShowInstallBanner(false);
  };

  return (
    <>
      {/* ── UPDATE AVAILABLE POPUP / BANNER ── */}
      {updateAvailable && (
        <div className="absolute top-2 inset-x-2 z-[99999] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="backdrop-blur-xl bg-gradient-to-r from-rose-600/95 to-pink-600/95 text-white p-3 rounded-2xl shadow-2xl border border-white/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <ArrowUpCircle className="w-5 h-5 text-white animate-bounce" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black truncate">🎉 New Update Ready!</p>
                <p className="text-[9px] text-white/80 font-semibold truncate">
                  Latest version {updateVersion || ''} installed & ready.
                </p>
              </div>
            </div>
            <button
              onClick={handleApplyUpdate}
              className="px-3 py-1.5 bg-white text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-wider shrink-0 cursor-pointer shadow hover:bg-rose-50 active:scale-95 transition-all flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Update Now</span>
            </button>
          </div>
        </div>
      )}

      {/* ── INSTALL APP ON MOBILE BANNER ── */}
      {showInstallBanner && !updateAvailable && (
        <div className="absolute top-2 inset-x-2 z-[99990] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="backdrop-blur-xl bg-zinc-950/90 text-white p-3 rounded-2xl shadow-2xl border border-white/15 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/logo.jpg" alt="ZOYO" className="w-8 h-8 rounded-xl object-cover shrink-0 border border-white/20" />
              <div className="min-w-0">
                <p className="text-xs font-black truncate">Install ZOYO App</p>
                <p className="text-[9px] text-white/60 font-semibold truncate">
                  Fast access from home screen & voice rooms
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleTriggerInstall}
                className="px-2.5 py-1.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider cursor-pointer shadow hover:opacity-90 active:scale-95 transition-all flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Install</span>
              </button>
              <button
                onClick={handleDismissInstall}
                className="p-1.5 text-white/40 hover:text-white rounded-lg cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
