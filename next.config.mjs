/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Signature images arrive as data URLs from the worker's phone.
      bodySizeLimit: "5mb"
    }
  }
};

export default nextConfig;
