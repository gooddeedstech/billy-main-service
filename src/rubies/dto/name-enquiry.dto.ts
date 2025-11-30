import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class NameEnquiryDto {
  @ApiProperty({ example: '000014' }) @IsString() accountBankCode: string;
  @ApiProperty({ example: '0123456789' }) @IsString() accountNumber: string;
}