import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ValidationModule } from './validation/validation.module';
import { WhitelistModule } from './whitelist/whitelist.module';
import { BlacklistModule } from './blacklist/blacklist.module';
import { RoleAccountModule } from './role-account/role-account.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    ValidationModule,
    WhitelistModule,
    BlacklistModule,
    RoleAccountModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
