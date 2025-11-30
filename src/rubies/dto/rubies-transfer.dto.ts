import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, Length } from 'class-validator';

export class RubiesTransferDto {
  @ApiProperty({
    example: 1000,
    description: 'The amount to transfer (in Naira)',
  })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    example: '000014',
    description: 'Bank code of the beneficiary bank (Rubies format)',
  })
  @IsString()
  @Length(3, 10)
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({
    example: 'Access Bank',
    description: 'Name of the beneficiary bank',
  })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Name of the credit account holder',
  })
  @IsString()
  @IsNotEmpty()
  creditAccountName: string;

  @ApiProperty({
    example: '0123456789',
    description: 'Beneficiary account number',
  })
  @IsString()
  @Length(10, 10)
  @IsNotEmpty()
  creditAccountNumber: string;


  @ApiProperty({
    example: '9999999999',
    description: 'Sender account number',
  })
  @IsString()
  @Length(10, 10)
  @IsNotEmpty()
  debitAccountNumber: string;

  @ApiProperty({
    example: 'Payment for invoice 123',
    description: 'Narration or purpose of transfer',
  })
  @IsString()
  narration: string;

  @ApiProperty({
    example: 'REF123456',
    description: 'Unique transaction reference for tracking',
  })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({
    example: '987654321098765432109876543210',
    description: 'Session ID for Rubies API tracking',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}