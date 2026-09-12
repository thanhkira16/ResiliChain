import { Body, Controller, Get, Post, Req, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from '../../../core/application/auth/auth.service';
import { CookieService } from '../services/cookie.service';
import {
  LoginUserDto,
  CreateUserDto,
} from '../../../core/application/auth/dto';
import {
  AccessTokenResponse,
  RegisterResponse,
} from '../../../core/application/auth/response';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginUserDto, @Res({ passthrough: true }) res: Response) : Promise<AccessTokenResponse> {
    const result = await this.authService.login(loginDto);
    this.cookieService.setRefreshTokenCookie(res, result.refresh_token);
    return {
      access_token: result.access_token
    };
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto): Promise<RegisterResponse> {
    return this.authService.registerUser(createUserDto);
  }

  @Post('refresh')
  async refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) : Promise<AccessTokenResponse> {
      const refreshToken = this.cookieService.getRefreshTokenFromCookie(req);
      if (!refreshToken) {
        res.status(401);
        throw new Error('Refresh token not found');
      }
    
      const result = await this.authService.refreshToken(refreshToken);
      return {
        access_token: result.access_token
      }
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
      const result = await this.authService.loginWithGoogle(req.user);
      this.cookieService.setRefreshTokenCookie(res, result.refresh_token);
      return res.json({
        access_token: result.access_token,
        message: 'Login successful',
        user: {
          id: (req.user as any).id,
          email: (req.user as any).email,
          username: (req.user as any).username,
        }
      });
  }
}
