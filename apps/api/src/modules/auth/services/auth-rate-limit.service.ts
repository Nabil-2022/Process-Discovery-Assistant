import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly configService: ConfigService) {}

  assertAllowed(action: string, ip: string | undefined, identity?: string) {
    const max = this.configService.get<number>('LOGIN_RATE_LIMIT_MAX', 5);
    const windowSeconds = this.configService.get<number>('LOGIN_RATE_LIMIT_WINDOW_SECONDS', 60);
    const now = Date.now();
    const identityKey = identity ? identity.toLowerCase().trim() : 'anonymous';
    const keys = [`${action}:ip:${ip ?? 'unknown'}`, `${action}:identity:${identityKey}`];

    for (const key of keys) {
      const current = this.buckets.get(key);
      if (!current || current.resetAt <= now) {
        this.buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        continue;
      }

      current.count += 1;
      if (current.count > max) {
        throw new HttpException(
          'Trop de tentatives. Réessayez plus tard.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }
}
