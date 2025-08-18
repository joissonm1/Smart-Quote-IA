import { PartialType } from '@nestjs/swagger';
import { CreateQuotationRequestDto } from './create-quotation-request.dto';

export class UpdateQuotationRequestDto extends PartialType(CreateQuotationRequestDto) {}
