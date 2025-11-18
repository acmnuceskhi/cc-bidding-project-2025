import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Production optimizations for Heroku/Render free tier
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header
  
  // Optimize images for faster loading
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
  },
  
  // Optimize for serverless deployment
  experimental: {
    // Reduce memory usage during builds
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;

