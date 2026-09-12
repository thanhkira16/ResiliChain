import { plainToInstance } from 'class-transformer';
import { User } from '../../../domain/user/entities/user.entity';
import { UserResponse } from '../response/user.response';

export class UserMapper {
  static toResponse(user: User): UserResponse {
    return plainToInstance(UserResponse, user, {
      excludeExtraneousValues: true,
    });
  }

  static toResponseList(users: User[]): UserResponse[] {
    return plainToInstance(UserResponse, users, {
      excludeExtraneousValues: true,
    });
  }
}
