import { IsString } from 'class-validator';

export class MetaFlowEncryptedDto {
  @IsString()
  encrypted_flow_data: string;

  @IsString()
  encrypted_aes_key: string;

  @IsString()
  initial_vector: string;
}