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

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: resolveBuildSha(),
  },
};

export default nextConfig;
