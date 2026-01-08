import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { RoleAccountService } from './role-account.service';
import { CreateRolePatternDto } from './dto/create-role-pattern.dto';

@Controller('api/v1/role-account')
export class RoleAccountController {
  constructor(private readonly roleAccountService: RoleAccountService) {}

  @Post('patterns')
  create(@Body() createDto: CreateRolePatternDto) {
    return this.roleAccountService.create(createDto);
  }

  @Get('patterns')
  findAll() {
    return this.roleAccountService.findAll();
  }

  @Get('patterns/:id')
  findOne(@Param('id') id: string) {
    return this.roleAccountService.findOne(id);
  }

  @Delete('patterns/:id')
  remove(@Param('id') id: string) {
    return this.roleAccountService.remove(id);
  }

  @Patch('patterns/:id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.roleAccountService.deactivate(id);
  }

  @Patch('patterns/:id/activate')
  activate(@Param('id') id: string) {
    return this.roleAccountService.activate(id);
  }

  @Post('check')
  async check(@Body() body: { email: string }) {
    const result = await this.roleAccountService.isRoleAccount(body.email);
    return {
      email: body.email,
      ...result,
    };
  }
}
