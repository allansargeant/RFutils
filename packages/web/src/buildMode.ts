/**
 * Which build this is. Kept in its own module with no imports so that
 * `staticBuild` is a bare compile-time constant: Vite substitutes the literal,
 * and the dead `if (staticBuild)` branches in api.ts — along with the dynamic
 * `import('./localApi.js')` inside them — are dropped from the server build.
 * That is what keeps pdfjs (2.7 MB of chunk and worker) out of the bundle the
 * local server ships, where conversion happens on the server anyway.
 */
export const staticBuild = import.meta.env.VITE_RFUTILS_STATIC === '1';
