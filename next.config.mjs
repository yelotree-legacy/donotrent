/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "supremesportrental.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
