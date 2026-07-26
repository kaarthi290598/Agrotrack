import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.6:3000", "192.168.0.6", "*.local"],
};

export default nextConfig;
