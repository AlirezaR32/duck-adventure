import type { NextConfig } from "next";

// NEXT_EXPORT=1 → static export (out/) for the Android/Capacitor APK shell.
// Default remains standalone for the web deployment.
const nextConfig: NextConfig = process.env.NEXT_EXPORT
  ? {
      output: "export",
      images: { unoptimized: true },
      typescript: { ignoreBuildErrors: true },
      reactStrictMode: false,
    }
  : {
      output: "standalone",
      /* config options here */
      typescript: {
        ignoreBuildErrors: true,
      },
      reactStrictMode: false,
    };

export default nextConfig;