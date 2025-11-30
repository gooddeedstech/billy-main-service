import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class RubiesCreateVirtualAccountDto {

  // Only ONE of BVN or NIN is required
  @ApiPropertyOptional({ example: "22693806811" })
  @IsString()
  @IsOptional()
  bvn?: string;

  @ApiPropertyOptional({ example: "14638565808" })
  @IsString()
  @IsOptional()
  nin?: string;


  @ApiProperty({ example: "Glory" })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: "Iweriebor" })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: "Male" })
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ example: "08033023846" })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: "jihti" })
  @IsString()
  @IsNotEmpty()
  reference: string;
}