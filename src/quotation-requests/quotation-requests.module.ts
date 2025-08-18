import { Module } from '@nestjs/common';
import { QuotationRequestsController } from './quotation-requests.controller';
import { QuotationRequestsService } from './quotation-requests.service';

@Module({
  controllers: [QuotationRequestsController],
  providers: [QuotationRequestsService],
})
export class QuotationRequestsModule {}
