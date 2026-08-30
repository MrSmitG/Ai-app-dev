/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENGINE_URL?: string;
  readonly VITE_WEB3_ADDRESS?: string;
  readonly VITE_WEB3_ENS?: string;
  readonly VITE_WEB3_SOLANA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
