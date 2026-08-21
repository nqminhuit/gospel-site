/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  // Ensure the committed data snapshot (resources/bible.db) ships inside the
  // serverless function bundle — it's only read via a runtime-computed path,
  // so file-tracing wouldn't otherwise pick it up.
  outputFileTracingIncludes: {
    '/**': ['./resources/bible.db'],
  },
};

export default nextConfig;
