import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { WhitelistService } from './whitelist.service';
import { CreateWhitelistDto } from './dto/create-whitelist.dto';

@Controller('api/v1/whitelist')
export class WhitelistController {
  constructor(private readonly whitelistService: WhitelistService) {}

  @Post()
  create(@Body() createDto: CreateWhitelistDto) {
    return this.whitelistService.create(createDto);
  }

  @Get()
  findAll(@Query('type') type?: 'domain' | 'email') {
    return this.whitelistService.findAll(type);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.whitelistService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.whitelistService.remove(id);
  }

  @Post('check')
  async check(@Body() body: { email: string }) {
    const isWhitelisted = await this.whitelistService.isWhitelisted(body.email);
    return {
      email: body.email,
      whitelisted: isWhitelisted,
    };
  }
}
