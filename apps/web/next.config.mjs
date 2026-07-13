const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const longCacheHeaders = [
  {
    key: "Cache-Control",
    value: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "pub-900a7c72b1034e658f23b0dca1f16fc2.r2.dev",
      },
    ],
  },
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: longCacheHeaders,
      },
      {
        source: "/assets/:path*",
        headers: longCacheHeaders,
      },
      {
        source: "/logo.svg",
        headers: longCacheHeaders,
      },
      {
        source: "/favicon.ico",
        headers: longCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
