/** Cross-platform desktop bridge (Electron) or browser fallback. */
export type LocalmodDesktop = {
  platform: string;
  isDesktop: boolean;
  versions?: { electron?: string; chrome?: string; node?: string };
};

declare global {
  interface Window {
    localmodDesktop?: LocalmodDesktop;
  }
}

export function getDesktop(): LocalmodDesktop {
  return (
    window.localmodDesktop || {
      platform: navigator.platform || "web",
      isDesktop: false,
    }
  );
}

export function isElectron() {
  return Boolean(window.localmodDesktop?.isDesktop);
}
