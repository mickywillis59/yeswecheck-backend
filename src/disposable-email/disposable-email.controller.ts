import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { DisposableEmailService } from './disposable-email.service';
import { CreateDisposableDto } from './dto/create-disposable.dto';

@Controller('api/v1/disposable-email')
export class DisposableEmailController {
  constructor(private readonly disposableService: DisposableEmailService) {}

  @Post()
  create(@Body() createDto: CreateDisposableDto) {
    return this.disposableService.create(createDto);
  }

  @Get()
  findAll() {
    return this.disposableService.findAll();
  }

  @Get('count')
  count() {
    return this.disposableService.count();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.disposableService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.disposableService.remove(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.disposableService.deactivate(id);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.disposableService.activate(id);
  }

  @Post('check')
  async check(@Body() body: { email: string }) {
    const result = await this.disposableService.isDisposable(body.email);
    return {
      email: body.email,
      ...result,
    };
  }

  @Post('import')
  async importBulk(@Body() body: { domains: string[] }) {
    return this.disposableService.importBulk(body.domains);
  }

  @Post('reload-redis')
  async reloadRedis() {
    await this.disposableService.reloadRedis();
    return { message: 'Redis reloaded successfully' };
  }
}
