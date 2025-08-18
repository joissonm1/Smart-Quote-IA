import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EmailService } from './email/email.service'; 
// import { ValidationPipe } from '@nestjs/common';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   app.useGlobalPipes(new ValidationPipe()); // habilita validação automática

//   await app.listen(3000);
//   console.log(`🚀 Application is running on: http://localhost:3000`);
// }
// bootstrap();
// main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('SmartQuote API')
    .setDescription('Documentação da API da RCS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const emailService = app.get(EmailService);
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
