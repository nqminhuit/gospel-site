/** @type {import('next').NextConfig} */
const nextConfig = {
  // sql.js does its own runtime fs/path-based asset loading (locateFile),
  // which bundlers can mangle — keep it external rather than webpack-bundled.
  serverExternalPackages: ['sql.js'],
  // Ensure the committed data snapshot (resources/bible.db) and sql.js's
  // wasm binary ship inside the serverless function bundle — both are only
  // read via a runtime-computed path, so file-tracing wouldn't otherwise
  // pick them up.
  outputFileTracingIncludes: {
    '/**': ['./resources/bible.db', './node_modules/sql.js/dist/sql-wasm.wasm'],
  },
};

export default nextConfig;
