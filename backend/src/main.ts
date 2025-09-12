import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useWebSocketAdapter(new IoAdapter(app));
  app.use(json({ limit: '1mb' }));

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
   
  console.log(`Backend (NestJS) listening on http://localhost:${port}`);
}

bootstrap();

