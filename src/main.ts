import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['https://smart-quote-front.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Se necessário para cookies ou autenticação
  });

  const config = new DocumentBuilder()
    .setTitle('SmartQuote API')
    .setDescription('Documentação da API da RCS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  await app.listen(process.env.PORT || 3001);
  console.log(
    `🚀 Application is running on: http://localhost:${process.env.PORT || 3001}`,
  );
}

bootstrap().catch((err) => {
  console.error('Erro ao iniciar a aplicação:', err);
  process.exit(1);
});
