import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConfirmTransferDto {
  @ApiProperty({ example: 'REF123456789' }) @IsString() reference: string;
}