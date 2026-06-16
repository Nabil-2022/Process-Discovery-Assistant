import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthPolicyGuard } from './guards/auth-policy.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthRateLimitService } from './services/auth-rate-limit.service';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, AuthRateLimitService, JwtAuthGuard, AuthPolicyGuard],
  exports: [JwtModule, AuthService, PasswordService, JwtAuthGuard, AuthPolicyGuard],
})
export class AuthModule {}
