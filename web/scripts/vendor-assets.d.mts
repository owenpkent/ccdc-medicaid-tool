// Types for the shared vendor-path helper, so vite.config.ts and the test that
// guards against drift can import it from TypeScript.
export declare function vendorPaths(): { tesseract: string; zxing: string };
