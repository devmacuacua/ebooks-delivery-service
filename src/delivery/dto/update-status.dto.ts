import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
