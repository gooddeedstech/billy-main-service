export type TransferStep =
  | 'ENTER_AMOUNT'
  | 'ENTER_ACCOUNT'
  | 'ENTER_BANK'
  | 'CONFIRM_PIN'
  | 'ENTER_PIN'
  | 'ASK_SAVE_BENEFICIARY'
  | 'DONE';

export interface TransferSessionData {
  amount?: number;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  accountName?: string;
}

export interface TransferSession {
  step: TransferStep;
  data: TransferSessionData;
  createdAt: number;
}