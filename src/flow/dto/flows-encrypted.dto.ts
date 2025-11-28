export class FlowsEncryptedDto {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
  authentication_tag: string;
}