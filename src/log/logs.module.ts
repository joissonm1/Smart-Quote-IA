import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [LogsService, PrismaService],
  controllers: [LogsController],
  exports: [LogsService],
})
export class LogsModule {}
