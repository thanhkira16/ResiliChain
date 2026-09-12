import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/core/application/auth/auth.service';

interface GoogleUser {
  googleId: string;
  email: string;
  username: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      // Keep the API available in local environments that do not enable Google OAuth.
      // The Google routes still require real credentials to complete an OAuth flow.
      clientID: configService.get<string>('google.clientId') || 'google-oauth-disabled',
      clientSecret: configService.get<string>('google.clientSecret') || 'google-oauth-disabled',
      callbackURL: configService.get<string>('google.callbackUrl') || 'http://localhost:3001/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    } as any);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const googleUser = this.extractUserData(profile);
      const user = await this.authService.findOrCreateGoogleUser(googleUser);
      
      done(null, user);
    } catch (error) {
      this.logger.error('Google OAuth validation failed', error);
      done(error, false);
    }
  }

  private extractUserData(profile: Profile): GoogleUser {
    const email = profile.emails?.[0]?.value;
    
    if (!email) {
      throw new Error('Email not found in Google profile');
    }

    return {
      googleId: profile.id,
      email,
      username: profile.displayName || email.split('@')[0],
    };
  }
}
