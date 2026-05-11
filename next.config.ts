import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function resolveBuildSha(): string {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown";
  }
}

function supabaseStorageHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: resolveBuildSha(),
  },
  images: {
    remotePatterns: [
      // Google OAuth profile photos
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // GitHub OAuth avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Supabase Storage (user-uploaded avatars + attachments)
      ...(supabaseStorageHostname()
        ? [{ protocol: "https" as const, hostname: supabaseStorageHostname() as string }]
        : []),
    ],
  },
};

export default nextConfig;
