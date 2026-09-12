import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../../../core/domain/auth/entities/refresh-token.entity';
import { AuthController } from '../controller/auth.controller';
import { AuthService } from '../../../core/application/auth/auth.service';
import { AuthRepository } from '../../persistence/typeorm/repository/auth.repository';
import { UsersModule } from './users.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasswordService } from '../../../core/application/auth/password.service';
import { TokenService } from '../../../core/application/auth/token.service';
import { AUTH_REPOSITORY_TOKEN } from '../../../core/common/constants/injection-tokens';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from 'src/infrastructure/common/strategies/google.strategy';
import { CookieService } from '../services/cookie.service';
import { jwtConfig } from 'src/infrastructure/config/jwt.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    forwardRef(() => UsersModule),
    PassportModule.register({ defaultStrategy: 'google' }),
    JwtModule.registerAsync(jwtConfig),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    AuthRepository, 
    PasswordService, 
    TokenService,
    GoogleStrategy,
    CookieService,
    {
      provide: AUTH_REPOSITORY_TOKEN,
      useClass: AuthRepository,
    },
  ],
  exports: [AuthService, AUTH_REPOSITORY_TOKEN, PasswordService, TokenService, JwtModule],
})
export class AuthModule {}
