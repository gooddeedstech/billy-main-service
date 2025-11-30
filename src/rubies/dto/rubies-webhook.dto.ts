export class RubiesWebhookDto {
  amount: string;
  bankCode: string;
  bankName: string;
  creditAccount: string;
  creditAccountName: string;
  drCr: 'DR' | 'CR';
  extraData?: string;
  narration: string;
  originatorAccountNumber: string;
  originatorName: string;
  paymentReference: string;
  requestTime: string;
  responseCode: string;
  responseMessage: string;
  responseTime: string;
  service: string;
  sessionId: string;
}