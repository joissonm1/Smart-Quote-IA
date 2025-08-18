import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';
import { RequestStatus } from '@prisma/client';

export class CreateQuotationRequestDto {
  @ApiProperty({ example: 'John Doe', description: 'Name of the requester' })
  @IsNotEmpty()
  @IsString()
  requester: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Requester email' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Need 10 office chairs', description: 'Description of the request' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: RequestStatus, example: RequestStatus.PENDING })
  @IsOptional()
  status?: RequestStatus;
}
