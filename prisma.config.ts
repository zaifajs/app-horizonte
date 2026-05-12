import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load both .env.local (local dev) and .env (used in VPS deploys).
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
