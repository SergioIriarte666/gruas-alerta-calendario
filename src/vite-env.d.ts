/// <reference types="vite/client" />

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  const pdfjs: any;
  export = pdfjs;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs?url' {
  const url: string;
  export default url;
}
