import {
  Controller,
  Get,
  Put,
  Delete,
  Query,
  Param,
  Body,
  ParseIntPipe,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../../../core/application/user/users.service';
import { UpdateUserDto } from '../../../core/application/user/dto/update-user.dto';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.usersService.findAll(paginationDto);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @Roles('admin')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @Roles('admin')
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }
}
