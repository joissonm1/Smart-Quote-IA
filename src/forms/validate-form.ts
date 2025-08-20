import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ValidateForm implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value.requester || value.requester.trim().length < 3) {
      throw new BadRequestException('Nome do cliente inválido ou muito curto');
    }

    if (!value.email || !this.isValidEmail(value.email)) {
      throw new BadRequestException('Email inválido');
    }

    if (!value.description || value.description.trim().length < 10) {
      throw new BadRequestException('Descrição muito curta ou ausente');
    }

    return value;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
