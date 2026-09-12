import { RefreshToken } from '../entities/refresh-token.entity';

export interface IAuthRepository {
  createRefreshToken(token: string, userId: number): Promise<RefreshToken>;
}
