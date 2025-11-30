import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';

export class FundTransferDto {
  @ApiProperty({ example: 1000 }) @IsNumber() amount: number;
  @ApiProperty({ example: '000014' }) @IsString() bankCode: string;
  @ApiProperty({ example: 'Access Bank' }) @IsString() bankName: string;
  @ApiProperty({ example: 'John Doe' }) @IsString() creditAccountName: string;
  @ApiProperty({ example: '0123456789' }) @IsString() creditAccountNumber: string;
  @ApiProperty({ example: 'Jane Doe' }) @IsString() debitAccountName: string;
  @ApiProperty({ example: '9999999999' }) @IsString() debitAccountNumber: string;
  @ApiProperty({ example: 'Payment for invoice 123' }) @IsString() narration: string;
  @ApiProperty({ example: 'REF123456' }) @IsString() reference: string;
  @ApiProperty({ example: '987654321098765432109876543210' }) @IsString() sessionId: string;
}