import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.validation';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/db?schema=process_discovery',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  APP_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:3000',
};

describe('validateEnvironment', () => {
  it('accepts the required MVP environment variables', () => {
    expect(validateEnvironment(validEnv).DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it('accepts same-domain API path for production reverse proxy', () => {
    expect(validateEnvironment({ ...validEnv, API_URL: '/api/v1' }).API_URL).toBe('/api/v1');
  });

  it('rejects missing required variables', () => {
    expect(() => validateEnvironment({})).toThrow('Invalid environment configuration');
  });
});
