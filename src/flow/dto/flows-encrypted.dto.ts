import { IsOptional, IsString } from 'class-validator';

export class FlowsEncryptedDto {
  @IsString()
  encrypted_key!: string;          // RSA-encrypted AES key (Base64)

  @IsString()
  encrypted_data!: string;         // AES-GCM ciphertext (Base64)

  @IsOptional()
  @IsString()
  encrypted_metadata?: string;     // optional, not used for now

  @IsString()
  iv!: string;                     // AES-GCM IV (Base64)

  @IsString()
  tag!: string;                    // AES-GCM auth tag (Base64)
}