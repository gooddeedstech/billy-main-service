import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ResolveBankDto {
  @ApiProperty({
    example: 'opay',
    description: 'Raw user message, e.g. from WhatsApp',
  })
  @IsString()
  @IsNotEmpty()
  bank!: string;

  @ApiProperty({
    example: '8182064092',
    description: '10-digit NUBAN account number extracted from message or UI',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10)
  accountNumber!: string;

}