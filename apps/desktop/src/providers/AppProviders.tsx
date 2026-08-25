import { createContext, useContext, type ReactNode } from "react";
import { getDesktop, type LocalmodDesktop } from "../platform";

const DesktopCtx = createContext<LocalmodDesktop>(getDesktop());

export function AppProviders({ children }: { children: ReactNode }) {
  return <DesktopCtx.Provider value={getDesktop()}>{children}</DesktopCtx.Provider>;
}

export function useDesktop() {
  return useContext(DesktopCtx);
}
