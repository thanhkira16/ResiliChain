import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InvalidTokenException } from 'src/core/common/exceptions/custom.exceptions';
import { ERROR_MESSAGES } from 'src/core/common/constants/error-messages';
import { TokenPayload } from 'src/core/domain/auth';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenExpiresIn = this.configService.get<string>(
      'JWT_ACCESS_TOKEN_EXPIRATION',
      '1h'
    );
    this.refreshTokenExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_EXPIRATION',
      '7d'
    );
  }

  generateTokens(payload: TokenPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  generateAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign(payload as any, {
      expiresIn: this.accessTokenExpiresIn,
    } as any);
  }

  generateRefreshToken(payload: TokenPayload): string {
    return this.jwtService.sign(payload as any, {
      expiresIn: this.refreshTokenExpiresIn,
    } as any);
  }

  verifyToken(token: string): TokenPayload {
    try {
      return this.jwtService.verify<TokenPayload>(token);
    } catch (error) {
      throw new InvalidTokenException(ERROR_MESSAGES.INVALID_TOKEN);
    }
  }

  decodeToken(token: string): TokenPayload | null {
    try {
      return this.jwtService.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}