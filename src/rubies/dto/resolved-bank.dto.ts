import { ApiProperty } from '@nestjs/swagger';

export type BankSource = 'text' | 'prefix' | 'enquiry' | 'verified';

export class ResolvedBankDto {
  @ApiProperty({ example: '000014' })
  bankCode!: string;

  @ApiProperty({ example: 'ACCESS' })
  bankName!: string;

  @ApiProperty({ example: 'ACCESS BANK', required: false })
  normalizedName?: string;

  @ApiProperty({ example: 'text | prefix | enquiry' })
  source!: BankSource;

  @ApiProperty({
    example: 0.92,
    description: 'Confidence score between 0 and 1',
  })
  confidenceScore!: number;

  @ApiProperty({
    example: 'JOHN DOE',
    description: 'Account name (when resolved via name-enquiry)',
    required: false,
  })
  accountName?: string;
}