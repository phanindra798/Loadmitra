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
  // Reverse-proxy hops to trust for the client IP (e.g. 1 behind an AWS load balancer).
  // Without it every request appears to come from the proxy and shares one rate-limit bucket.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // "screen" returns the login code in the API response (local dev, or a clearly
  // labelled demo deployment). "sms" needs an SMS adapter, which does not exist yet,
  // so login answers 503. Defaults: screen outside production, sms in production.
  OTP_DELIVERY: z.enum(["screen", "sms"]).optional(),
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
  otpDelivery: parsed.data.OTP_DELIVERY ?? (parsed.data.NODE_ENV === "production" ? "sms" : "screen"),
};

if (env.isProd && env.otpDelivery === "screen") {
  console.warn(
    "⚠️  OTP_DELIVERY=screen in production: login codes are shown to whoever requests them, so anyone can sign in as any phone number. Demo deployments only.",
  );
}

// In production a weak/default JWT secret lets anyone forge auth tokens. Fail
// fast rather than boot silently insecure. The dev default stays usable locally.
if (env.isProd && (env.JWT_SECRET === "dev-only-change-me" || env.JWT_SECRET.length < 16)) {
  console.error(
    "❌ JWT_SECRET must be a strong, non-default value in production (>= 16 chars). Set it in the environment.",
  );
  process.exit(1);
}
