import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // If deploying to a repo other than username.github.io, uncomment and set basePath:
  // basePath: '/habit-tracker',
};

export default nextConfig;
