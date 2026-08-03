import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both supported local Desktop origins need development client and HMR access.
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
};

export default nextConfig;
