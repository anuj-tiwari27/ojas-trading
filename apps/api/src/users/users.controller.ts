import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { RequestUser } from '../common/types/request-user';
import { AssignRolesDto, CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('User Management')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('roles')
  @RequirePermissions('user:read')
  roles(@CurrentUser() user: RequestUser) {
    return this.users.listRoles(user);
  }

  @Get('permissions')
  @RequirePermissions('user:read')
  permissions() {
    return this.users.listPermissions();
  }

  @Get()
  @RequirePermissions('user:read')
  list(@CurrentUser() user: RequestUser, @Query() q: PaginationQueryDto) {
    return this.users.list(user, q);
  }

  @Get(':id')
  @RequirePermissions('user:read')
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.users.get(user, id);
  }

  @Post()
  @RequirePermissions('user:create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user, id, dto);
  }

  @Put(':id/roles')
  @RequirePermissions('user:update')
  assignRoles(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: AssignRolesDto,
  ) {
    return this.users.assignRoles(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('user:delete')
  deactivate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.users.deactivate(user, id);
  }
}
