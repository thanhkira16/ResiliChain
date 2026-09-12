import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../../core/domain/user/entities/user.entity';
import { UsersController } from '../controller/users.controller';
import { UsersService } from '../../../core/application/user/users.service';
import { UsersRepository } from '../../persistence/typeorm/repository/users.repository';
import { USER_REPOSITORY_TOKEN } from '../../../core/common/constants/injection-tokens';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [
    UsersService, 
    UsersRepository,
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UsersRepository,
    },
  ],
  exports: [UsersService, USER_REPOSITORY_TOKEN],
})
export class UsersModule {}
