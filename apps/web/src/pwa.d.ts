/// <reference types="vite-plugin-pwa/client" />

declare global {
  interface Window {
    __updateSW?: (reloadPage?: boolean) => Promise<void>;
  }
}

export {};
