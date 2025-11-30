import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class RubiesBvnValidationDto {
  @ApiProperty({ example: '55779088653', description: 'Bank Verification Number (BVN)' })
  @IsString()
  @IsNotEmpty()
  bvn: string;

  @ApiProperty({ example: '1999-09-23', description: 'Date of birth (YYYY-MM-DD)' })
  @IsDateString()
  dob: string;

  @ApiProperty({ example: 'John', description: 'First name of the BVN holder' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name of the BVN holder' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'Test12345tree', description: 'Unique reference for the KYC request' })
  @IsString()
  @IsNotEmpty()
  reference: string;
}

export class RubiesNinValidationDto {
  @ApiProperty({
    example: '1990-05-12',
    description: 'Date of birth in YYYY-MM-DD format',
  })
  @IsString()
  @IsNotEmpty()
  dob!: string;

  @ApiProperty({ example: 'John', description: 'First name of the user' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'Last name of the user' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '12345678901', description: '11-digit NIN number' })
  @IsString()
  @IsNotEmpty()
  idNumber!: string;

  @ApiProperty({
    example: 'billy-kyc-req-001',
    description: 'Unique reference for the NIN validation transaction',
  })
  @IsString()
  @IsNotEmpty()
  reference!: string;
}