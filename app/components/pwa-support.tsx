"use client";

import { useEffect, useState } from "react";
import styles from "./pwa-support.module.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_INSTALL_KEY = "studioflow-install-dismissed";
const THEME_PREFERENCE_COOKIE = "studioflow_theme_preference";

function isIosSafari() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Registers the privacy-safe asset cache and exposes non-blocking install/offline UI. */
export function PwaSupport({ persistTheme = false }: { persistTheme?: boolean }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosInstall, setShowIosInstall] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(DISMISSED_INSTALL_KEY) !== "1" && isIosSafari() && !isStandalone());

  useEffect(() => {
    if (persistTheme) {
      const theme = document.documentElement.dataset.theme;
      if (theme) document.cookie = `${THEME_PREFERENCE_COOKIE}=${encodeURIComponent(theme)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The application remains usable online when registration is unavailable.
      });
    }

    const dismissed = window.localStorage.getItem(DISMISSED_INSTALL_KEY) === "1";
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (!dismissed) setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, [persistTheme]);

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_INSTALL_KEY, "1");
    setInstallEvent(null);
    setShowIosInstall(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return <>
    {installEvent && <aside className={styles.install} aria-label="Install StudioFlow">
      <span>Install StudioFlow for quicker access.</span><button onClick={install}>Install</button><button className={styles.dismiss} onClick={dismiss} aria-label="Dismiss install prompt">Not now</button>
    </aside>}
    {showIosInstall && <aside className={styles.install} aria-label="Add StudioFlow to your Home Screen">
      <span>Add StudioFlow to your Home Screen: tap Share, then “Add to Home Screen”.</span><button className={styles.dismiss} onClick={dismiss}>Got it</button>
    </aside>}
  </>;
}
