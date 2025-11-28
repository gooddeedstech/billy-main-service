export class FlowsEncryptedDto {
  encrypted_flow_data!: {
    encrypted_key: string;
    encrypted_data: string;
    encrypted_metadata: string;
    iv: string;
    tag: string;
  };
}