import { Injectable, Inject } from '@nestjs/common';
import { User } from '../../domain/user/entities/user.entity';
import type { IUserRepository } from '../../domain/user/interface/user.repository.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  PaginationDto,
  UserNotFoundException,
  UserAlreadyExistsException,
  ERROR_MESSAGES,
  USER_REPOSITORY_TOKEN,
} from '../../common';
import { UserResponse } from './response';
import { UserMapper } from './mappers/user.mapper';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN) 
    private readonly usersRepository: IUserRepository) {}

  async findAll(paginationDto: PaginationDto) {
    const { page, limit, skip } = paginationDto;

    const [users, total] = await this.usersRepository.findAll({page,limit,skip});

    const totalPages = Math.ceil(total / limit);

    const mappedUsers = UserMapper.toResponseList(users);

    return {
      data: mappedUsers,
      totalItems: total,
      itemCount: users.length,
      itemsPerPage: limit,
      currentPage: page,
      totalPages: totalPages,
    };
  }

  async findById(id: number): Promise<UserResponse> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new UserNotFoundException(`User with ID ${id} not found`);
    }
    return UserMapper.toResponse(user);
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    const existingUser = await this.findById(id);

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const userWithEmail = await this.usersRepository.findByEmail(updateUserDto.email);
      if (userWithEmail) {
        throw new UserAlreadyExistsException(
          ERROR_MESSAGES.USER_ALREADY_EXISTS,
        );
      }
    }
    
    const data = await this.usersRepository.updateById(id, updateUserDto);

    return UserMapper.toResponse(data);
  }

  async deleteUser(id: number): Promise<void> {
    await this.findById(id); 
    await this.usersRepository.deleteById(id);
  }
}
