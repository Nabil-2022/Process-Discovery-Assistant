import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  constructor(private readonly configService: ConfigService) {}

  async hash(password: string) {
    this.assertPolicy(password);
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(hash: string | null | undefined, password: string) {
    if (!hash) {
      return false;
    }

    return argon2.verify(hash, password);
  }

  assertPolicy(password: string) {
    const minLength = this.configService.get<number>('PASSWORD_MIN_LENGTH', 12);
    if (password.length < minLength) {
      throw new BadRequestException(
        `Le mot de passe doit contenir au moins ${minLength} caractères.`,
      );
    }

    if (password.length > 256) {
      throw new BadRequestException('Le mot de passe dépasse la longueur maximale autorisée.');
    }
  }
}
