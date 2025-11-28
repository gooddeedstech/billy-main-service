export class FlowsEncryptedDto {
  encrypted_key!: string;          // RSA-encrypted symmetric key (Base64)
  encrypted_data!: string;         // AES-GCM ciphertext (Base64)
  encrypted_metadata!: string;     // AES-GCM ciphertext (Base64)
  iv!: string;                     // initialization vector (Base64)
  tag!: string;                    // auth tag (Base64)
}