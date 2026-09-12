import { BaseEntity } from '../../base.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ length: 100 })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  password?: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ type: 'varchar', nullable: true }) 
  googleId?: string;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshToken[];
}
