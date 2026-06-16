import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));
const urlOrAbsolutePath = z
  .string()
  .min(1)
  .refine((value) => value.startsWith('/') || z.string().url().safeParse(value).success, {
    message: 'Must be a URL or an absolute path',
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional().default('development'),
  PORT: z.coerce.number().int().positive().optional().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_DATABASE_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1, 'JWT_ACCESS_EXPIRES_IN is required'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1, 'JWT_REFRESH_EXPIRES_IN is required'),
  APP_URL: z.string().url('APP_URL must be a valid URL'),
  API_URL: urlOrAbsolutePath,
  FRONTEND_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().url().optional(),
  ENABLE_SWAGGER: z.coerce.boolean().optional().default(false),
  AI_PROVIDER: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: optionalUrl,
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional(),
  STORAGE_ENDPOINT: optionalUrl,
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional().or(z.literal('')),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(128).optional().default(12),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional().default(5),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().optional().default(60),
  PASSWORD_RESET_EXPIRES_IN: z.string().optional().default('30m'),
  INVITATION_EXPIRES_IN: z.string().optional().default('7d'),
  COOKIE_SECURE: z.coerce.boolean().optional().default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).optional().default('lax'),
  COOKIE_DOMAIN: z.string().optional(),
  SUPPORT_ACCESS_MAX_DAYS: z.coerce.number().int().positive().max(90).optional().default(14),
  LOCAL_AUTH_BYPASS: z.coerce.boolean().optional().default(true),
});

export type AppEnvironment = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>): AppEnvironment {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return parsed.data;
}
