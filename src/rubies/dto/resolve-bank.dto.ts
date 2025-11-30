import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ResolveBankDto {
  @ApiProperty({
    example: 'Please credit 50k into 0234567890 Keystone Bank',
    description: 'Raw user message, e.g. from WhatsApp',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({
    example: '0234567890',
    description: '10-digit NUBAN account number extracted from message or UI',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10)
  accountNumber!: string;


   @ApiProperty({
    example: '0234567890',
    description: 'Amount to be sent',
  })
  @IsString()
  @IsNotEmpty()
  amount!: string;
}