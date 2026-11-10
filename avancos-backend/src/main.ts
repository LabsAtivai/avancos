import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS restrito: só origens listadas em CORS_ORIGINS (separadas por vírgula).
  // Sem a variável, nenhum cabeçalho CORS é emitido (front em produção usa proxy same-origin).
  const origens = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  if (origens.length) app.enableCors({ origin: origens });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Avanços Comerciais API rodando na porta ${port}`);
}
bootstrap();
