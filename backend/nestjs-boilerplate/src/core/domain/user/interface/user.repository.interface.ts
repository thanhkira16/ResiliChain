import { User } from '../entities/user.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export interface IUserRepository {
  findAll(paginationDto: PaginationDto): Promise<[User[], number]>;
  findAndCount(options: any): Promise<[User[], number]>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  createOne(userData: Partial<User>): Promise<User>;
  updateById(id: number, updateData: Partial<User>): Promise<User>;
  deleteById(id: number): Promise<void>;
  findByGoogleId(googleId: string): Promise<User | null>;
}
