import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../../../core/domain/user/entities/user.entity';
import { Repository } from 'typeorm';
import { RefreshToken } from '../../../../core/domain/auth/entities/refresh-token.entity';
import { IAuthRepository } from '../../../../core/domain/auth/interface/auth.repository.interface';

@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async createRefreshToken(refreshToken: string, userId: number,): Promise<RefreshToken> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const token = new RefreshToken();
    token.token = refreshToken;
    token.user = { id: userId } as User;
    token.expiresAt = expiresAt;

    return this.refreshTokenRepository.save(token);
  }

}
