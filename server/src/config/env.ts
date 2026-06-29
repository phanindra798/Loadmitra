import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/**
 * Validate and type all environment variables at boot. Fails fast with a clear
 * message if anything required is missing/invalid.
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(1).default("dev-only-change-me"),
  CORS_ORIGIN: z.string().default("http://localhost:8080,http://localhost:8081"),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === "production",
};

// In production a weak/default JWT secret lets anyone forge auth tokens. Fail
// fast rather than boot silently insecure. The dev default stays usable locally.
if (env.isProd && (env.JWT_SECRET === "dev-only-change-me" || env.JWT_SECRET.length < 16)) {
  console.error(
    "❌ JWT_SECRET must be a strong, non-default value in production (>= 16 chars). Set it in the environment.",
  );
  process.exit(1);
}
