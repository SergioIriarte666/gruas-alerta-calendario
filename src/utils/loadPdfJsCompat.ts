import pdfJsWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

type PromiseWithResolversResult<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type PromiseWithResolversConstructor = PromiseConstructor & {
  withResolvers?: <T>() => PromiseWithResolversResult<T>;
};

type UrlWithParseConstructor = typeof URL & {
  parse?: (input: string | URL, base?: string | URL) => URL | null;
};

type GlobalWithStructuredClone = typeof globalThis & {
  structuredClone?: (value: unknown, options?: { transfer?: unknown[] }) => unknown;
};

export type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfJsPromise: Promise<PdfJsModule> | null = null;

export const pdfJsWorkerSrc = pdfJsWorkerUrl;

const installPromiseWithResolversPolyfill = () => {
  const promiseConstructor = Promise as PromiseWithResolversConstructor;

  if (typeof promiseConstructor.withResolvers === 'function') return;

  promiseConstructor.withResolvers = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };
};

const installUrlParsePolyfill = () => {
  const urlConstructor = URL as UrlWithParseConstructor;

  if (typeof urlConstructor.parse === 'function') return;

  urlConstructor.parse = (input: string | URL, base?: string | URL) => {
    try {
      const normalizedInput = input instanceof URL ? input.toString() : input;
      if (base) {
        const normalizedBase = base instanceof URL ? base.toString() : base;
        return new URL(normalizedInput, normalizedBase);
      }
      return new URL(normalizedInput);
    } catch {
      return null;
    }
  };
};

const installStructuredClonePolyfill = () => {
  const globalScope = globalThis as GlobalWithStructuredClone;

  if (typeof globalScope.structuredClone === 'function') return;

  globalScope.structuredClone = (value: unknown) => {
    if (value instanceof ArrayBuffer) return value.slice(0);

    if (ArrayBuffer.isView(value)) {
      if (value instanceof DataView) {
        const copiedBuffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
        return new DataView(copiedBuffer);
      }

      const typedArray = value as any;
      return new typedArray.constructor(typedArray);
    }

    if (value instanceof Date) return new Date(value.getTime());
    if (value === undefined || value === null) return value;

    return JSON.parse(JSON.stringify(value));
  };
};

const installPdfJsPolyfills = () => {
  installPromiseWithResolversPolyfill();
  installUrlParsePolyfill();
  installStructuredClonePolyfill();
};

export const loadPdfJsCompat = async (): Promise<PdfJsModule> => {
  if (!pdfJsPromise) {
    installPdfJsPolyfills();

    pdfJsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((module) => {
        if (!module.GlobalWorkerOptions.workerSrc) {
          module.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;
        }

        return module;
      })
      .catch((error) => {
        pdfJsPromise = null;
        throw error;
      });
  }

  return pdfJsPromise;
};
