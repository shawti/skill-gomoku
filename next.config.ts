import type { NextConfig } from "next";

// 通过环境变量注入仓库名作为 basePath，例如 BASE_PATH="/skill-gomoku"
const basePath = process.env.BASE_PATH;

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // 仅在提供 BASE_PATH 时设置 basePath（必须以 / 开头）
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
