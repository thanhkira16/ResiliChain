import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  domain?: string;
  path?: string;
}

@Injectable()
export class CookieService {
  private readonly defaultOptions: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };


  setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const options: CookieOptions = {
      ...this.defaultOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('refresh_token', refreshToken, options);
  }

  clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  getCookie(req: Request, name: string): string | undefined {
    return req.cookies?.[name];
  }

  getRefreshTokenFromCookie(req: Request): string | undefined {
    return this.getCookie(req, 'refresh_token');
  }
}