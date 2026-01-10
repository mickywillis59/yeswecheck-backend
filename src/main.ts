import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ✅ Activer CORS pour les requêtes externes
  app.enableCors({
    origin: ['https://email.yeswecheck.fr', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Servir les fichiers statiques
  app.useStaticAssets(join(__dirname, '..', '..', 'public'));

  await app.listen(3000);
  console.log('🚀 Application running on http://localhost:3000');
}
bootstrap();
