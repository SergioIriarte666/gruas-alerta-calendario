/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  const pdfjs: any;
  export = pdfjs;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs?url' {
  const url: string;
  export default url;
}
