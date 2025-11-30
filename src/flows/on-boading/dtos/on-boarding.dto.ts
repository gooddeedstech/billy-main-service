import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsDateString, IsNotEmpty } from 'class-validator';

export class OnboardingFlowDto {
  @ApiProperty({
    description: "Verification method selected by user",
    example: "bvn",
    enum: ["bvn", "nin"],
  })
  @IsString()
  @IsIn(["bvn", "nin"])
  method!: "bvn" | "nin";

  @ApiProperty({
    description: "BVN entered by user",
    example: "22345678901",
    required: false,
  })
  @IsString()
  @IsOptional()
  bvn_number?: string;

  @ApiProperty({
    description: "NIN entered by user",
    example: "12345678901",
    required: false,
  })
  @IsString()
  @IsOptional()
  nin_number?: string;

  @ApiProperty({
    description: "User’s date of birth (used for KYC)",
    example: "1990-01-01",
  })
  @IsDateString()
  id_dob!: string;

  @ApiProperty({
    description: "Transaction PIN (4 digits)",
    example: "1234",
  })
  @IsString()
  @IsNotEmpty()
  pin!: string;

  @ApiProperty({
    description: "PIN confirmation",
    example: "1234",
  })
  @IsString()
  @IsNotEmpty()
  confirm_pin!: string;

  @ApiProperty({ example: "John", description: "User's first name" })
  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @ApiProperty({ example: "Doe", description: "User's last name" })
  @IsString()
  @IsNotEmpty()
  last_name!: string;

  @ApiProperty({
    example: "test@example.com",
    description: "Email address",
    required: false,
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: "male",
    description: "Gender selected by user",
  })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiProperty({
    example: "2348182064092",
    description: "WhatsApp phone number (msisdn)",
  })
  @IsString()
  @IsOptional()
  phone_number?: string;
}