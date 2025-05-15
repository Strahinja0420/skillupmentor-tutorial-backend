import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { User } from 'entities/user.entity'
import { PaginatedResult } from 'interfaces/paginated-result.interface'
import { CreateUserDto } from 'modules/users/dto/create-user.dto'
import { RolesService } from './roles.service'
import { Role } from 'entities/role.entity'
import { CreateUpdateRoleDto } from './dto/create-update-role.dto'

@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<Role[]> {
    return this.rolesService.findAll(['permissions'])
  }

  @Get('/paginated')
  @HttpCode(HttpStatus.OK)
  async paginated(@Query('page') page: number): Promise<PaginatedResult> {
    return this.rolesService.paginate(page, ['permissions'])
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string): Promise<Role> {
    return this.rolesService.findById(id, ['permissions'])
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createRoledto: CreateUpdateRoleDto,
    @Body('permissions') permissionIds: string[],
  ): Promise<Role> {
    if (permissionIds.length === 0) {
      throw new BadRequestException('There should be atleast 1 permission selected')
    }
    /* n 
        instead of -> [1,2]
        we get -> [{id:1}, {id:2}]
    */
    return this.rolesService.create(
      createRoledto,
      permissionIds.map((id) => ({
        id,
      })),
    )
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: CreateUpdateRoleDto,
    @Body('permissions') permissionIds: string[],
  ): Promise<Role> {
    return this.rolesService.update(
      id,
      updateRoleDto,
      permissionIds.map((id) => ({
        id,
      })),
    )
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<Role> {
    return this.rolesService.remove(id)
  }
}
