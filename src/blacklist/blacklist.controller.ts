import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { BlacklistService } from './blacklist.service';
import { CreateBlacklistDto } from './dto/create-blacklist.dto';

@Controller('api/v1/blacklist')
export class BlacklistController {
  constructor(private readonly blacklistService: BlacklistService) {}

  @Post()
  create(@Body() createDto: CreateBlacklistDto) {
    return this.blacklistService.create(createDto);
  }

  @Get()
  findAll(@Query('type') type?: 'domain' | 'email') {
    return this.blacklistService.findAll(type);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.blacklistService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blacklistService.remove(id);
  }

  @Post('check')
  async check(@Body() body: { email: string }) {
    const isBlacklisted = await this.blacklistService.isBlacklisted(body.email);
    return {
      email: body.email,
      blacklisted: isBlacklisted,
    };
  }
}
