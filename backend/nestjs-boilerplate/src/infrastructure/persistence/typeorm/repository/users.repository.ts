import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../../core/domain/user/entities/user.entity';
import { UpdateUserDto } from '../../../../core/application/user/dto/update-user.dto';
import { IUserRepository } from '../../../../core/domain/user/interface/user.repository.interface';
import { PaginationDto } from '../../../../core/common/dto/pagination.dto';

@Injectable()
export class UsersRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createOne(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async updateById(id: number, updateData: UpdateUserDto): Promise<User> {
    await this.userRepository.update(id, updateData);
    const updatedUser = await this.findById(id);
    if (!updatedUser) {
      throw new Error('User not found after update');
    }
    return updatedUser;
  }

  async deleteById(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  async findAndCount(options: any): Promise<[User[], number]> {
    return this.userRepository.findAndCount(options);
  }

  async findAll(paginationDto: PaginationDto): Promise<[User[], number]> {
    const { page, limit, skip } = paginationDto;
    return this.userRepository.findAndCount({
      skip: skip,
      take: limit,
      order: { id: 'DESC' },
    });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleId } });
  }
}
