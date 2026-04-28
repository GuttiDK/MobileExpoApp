import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['10.131.20.76'],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
