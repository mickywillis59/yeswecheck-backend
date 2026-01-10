import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'yeswecheck_user'),
        password: configService.get<string>(
          'DATABASE_PASSWORD',
          'SecurePassword123!',
        ),
        database: configService.get<string>('DATABASE_NAME', 'yeswecheck'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize:
          configService.get<string>('NODE_ENV', 'development') ===
          'development',
        logging:
          configService.get<string>('NODE_ENV', 'development') ===
          'development',
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
