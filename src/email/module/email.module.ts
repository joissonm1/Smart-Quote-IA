import { Module } from '@nestjs/common';
import { EmailService } from '../service/email.service';
import { ConfigModule } from '@nestjs/config';
import { EmailQueueService } from '../service/email-queue.service';
import { EmailProcessorService } from '../service/email-processor.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, EmailQueueService, EmailProcessorService],
  exports: [EmailService, EmailQueueService, EmailProcessorService],
})
export class EmailModule {}
