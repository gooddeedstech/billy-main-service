export type TransferStep =
  | 'ENTER_AMOUNT'
  | 'ENTER_ACCOUNT'
  | 'ENTER_BANK'
  | 'CONFIRM'
  | 'ENTER_PIN';

export interface TransferSessionData {
  amount?: number;
  rawAmount?: string;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  accountName?: string;
}

export interface TransferSession {
  step: TransferStep;
  data: TransferSessionData;
}