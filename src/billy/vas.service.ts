import { Injectable, BadRequestException } from '@nestjs/common';
import { UserService } from '@/flows/on-boading/services/user.service';
import { WhatsappApiService } from '@/whatsapp/whatsapp-api.service';
import { RubiesService } from '@/rubies/rubies.service';

import * as bcrypt from 'bcryptjs';
import { TransferParserService } from './bank-transfer/transfer-parser.service';
import { BankResolverService } from './bank-transfer/bank-resolver.service';
import { CacheService } from '@/cache/cache.service';

@Injectable()
export class VasService {
  constructor(
    private readonly userService: UserService,
    private readonly whatsapp: WhatsappApiService,
    private readonly parser: TransferParserService,
    private readonly bankResolver: BankResolverService,
    private readonly rubies: RubiesService,
    private readonly cache: CacheService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                               0. UTILITIES                                 */
  /* -------------------------------------------------------------------------- */

  async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* -------------------------------------------------------------------------- */
  /*                               1. MAIN ROUTER                               */
  /* -------------------------------------------------------------------------- */

  async handleVAS(user, msg) {
    const text = msg.text?.body?.trim().toLowerCase();
    const phone = user.phoneNumber;
    const messageId = msg.id

    // 1) Transfer keywords
    if (text.startsWith('transfer')) {
      return await this.startTransferFlow(user, messageId);
    }

    // 2) Airtime
    if (text.startsWith('airtime')) {
      return await this.startAirtimeFlow(user, messageId);
    }

    // 3) Bills
    if (
      text.startsWith('dstv') ||
      text.startsWith('gotv') ||
      text.startsWith('electricity') ||
      text.startsWith('ikeja') ||
      text.startsWith('abuja')
    ) {
      return await this.startBillsFlow(user, messageId);
    }

    // 4) Crypto
    if (text.startsWith('buy') || text.startsWith('sell')) {
      return await this.startCryptoFlow(user, messageId);
    }

    // 5) Balance
    if (text === 'balance' || text === 'wallet') {
   //   return await this.getWalletBalance(phone);
    }

    // 6) PIN confirmation (dynamic)
    if (/^\d{4}$/.test(text)) {
      return await this.handlePinAuth(user, messageId);
    }

    // Fallback → Menu
    return await this.sendMenu(phone, messageId);
  }

  /* -------------------------------------------------------------------------- */
  /*                            2. SEND USER MENU                               */
  /* -------------------------------------------------------------------------- */

  async sendMenu(phone, messageId) {
    await this.whatsapp.sendTypingIndicator(phone, messageId);
    await this.delay(900);

    return await this.whatsapp.sendText(
      phone,
      `📍 *Billy Menu*\n\n` +
        `1️⃣ Transfer Money\n` +
        `2️⃣ Airtime & Data\n` +
        `3️⃣ Bills (DSTV, Electricity, etc.)\n` +
        `4️⃣ Crypto Trading\n` +
        `5️⃣ Check Wallet Balance\n\n` +
        `Simply type:\n` +
        `• *transfer 5000 to 0022334455 GTBank*\n` +
        `• *airtime 1000 08123456789*\n` +
        `• *dstv 12000 7032482829*\n` +
        `• *buy 50 usdt*\n` +
        `• *balance*`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                         3. TRANSFER START FLOW                              */
  /* -------------------------------------------------------------------------- */

  /** ------------------------------------------------------
   * 1️⃣ USER SELECTS TRANSFER FROM MENU
   * ------------------------------------------------------ */

  async startTransferFlow(from: string, messageId: string) {
  // create session
  await this.cache.set(`tx:${from}`, {
    step: "ENTER_AMOUNT",
    data: {}
  });

  await this.whatsapp.sendTypingIndicator(from, messageId);
  await this.whatsapp.sendText(
    from,
    `💸 *Transfer Money*\n\nHow much do you want to transfer?`
  );

  return 'ask_amount';
}
  


  /** ------------------------------------------------------
   * 2️⃣ USER ENTERS AMOUNT
   * ------------------------------------------------------ */
  async handleTransferAmount(phone: string, amount: string) {
    if (isNaN(Number(amount)) || Number(amount) < 100) {
      return await this.whatsapp.sendText(
        phone,
        `❗ Invalid amount. Please enter a valid number above ₦100.`
      );
    }

    await this.cache.set(`tx:${phone}`, {
      step: 'ENTER_ACCOUNT',
      amount: Number(amount),
    });

    return await this.whatsapp.sendText(
      phone,
      `👌 Great! Now enter the *account number*.`
    );
  }

  /** ------------------------------------------------------
   * 3️⃣ USER ENTERS ACCOUNT NUMBER
   * ------------------------------------------------------ */
  async handleAccountNumber(phone: string, accountNumber: string) {
    if (!/^\d{10}$/.test(accountNumber)) {
      return await this.whatsapp.sendText(
        phone,
        `❗ Account number must be *10 digits*. Try again.`
      );
    }

    const tx = await this.cache.get(`tx:${phone}`);

    await this.cache.set(`tx:${phone}`, {
      ...tx,
      step: 'ENTER_BANK',
      accountNumber,
    });

    return await this.whatsapp.sendText(
      phone,
      `🏦 Please enter the *bank name*.\nExample: GTBank, Access, Zenith`
    );
  }

  /** ------------------------------------------------------
   * 4️⃣ USER ENTERS BANK → DO NAME ENQUIRY
   * ------------------------------------------------------ */
  async handleBankName(phone: string, bankName: string) {
    const tx = await this.cache.get(`tx:${phone}`);
    if (!tx) return;

    const banks = await this.bankResolver.resolveBank(bankName, tx.accountNumber);

    if (!banks?.length) {
      return await this.whatsapp.sendText(
        phone,
        `❗ Bank not found. Please enter a correct bank name.`
      );
    }

    const bank = banks[0];

    const enquiry = await this.rubies.nameEnquiry(
      bank.bankCode,
      tx.accountNumber,
    );

    if (enquiry?.data?.responseCode !== '00') {
      return await this.whatsapp.sendText(
        phone,
        `⚠️ Invalid account number for ${bank.bankName}.`
      );
    }

    const accountName = enquiry.data.accountName;

    await this.cache.set(`tx:${phone}`, {
      ...tx,
      step: 'CONFIRM',
      bankCode: bank.bankCode,
      bankName: bank.bankName,
      accountName,
    });

    return await this.whatsapp.sendText(
      phone,
      `🔍 *Confirm Transfer*\n\n` +
        `• Amount: ₦${tx.amount}\n` +
        `• Bank: ${bank.bankName}\n` +
        `• Account Number: ${tx.accountNumber}\n` +
        `• Account Name: ${accountName}\n\n` +
        `Type *yes* to continue or *no* to cancel.`
    );
  }

  /** ------------------------------------------------------
   * 5️⃣ USER CONFIRMS → ASK FOR PIN
   * ------------------------------------------------------ */
  async handleTransferConfirmation(phone: string, text: string) {
    const lower = text.toLowerCase();

    if (lower !== 'yes') {
      await this.cache.delete(`tx:${phone}`);
      return await this.whatsapp.sendText(phone, `❌ Transfer cancelled.`);
    }

    const tx = await this.cache.get(`tx:${phone}`);

    await this.cache.set(`tx:${phone}`, { ...tx, step: 'ENTER_PIN' });

    return await this.whatsapp.sendText(
      phone,
      `🔐 Enter your *4-digit transaction PIN* to complete this transfer.`
    );
  }

  /** ------------------------------------------------------
   * 6️⃣ USER ENTERS PIN → EXECUTE TRANSFER
   * ------------------------------------------------------ */
  async handlePinEntry(phone: string, pin: string) {
    const user = await this.userService.findByPhone(phone);

    const tx = await this.cache.get(`tx:${phone}`);

    const validPin = await this.userService.validatePin(phone, pin);

    if (!validPin) {
      return await this.whatsapp.sendText(phone, `❌ Incorrect PIN.`);
    }

    // Execute Rubies transfer
    const result = await this.rubies.fundTransfer({
      amount: tx.amount,
      creditAccountNumber: tx.accountNumber,
      creditAccountName: tx.accountName,
      bankCode: tx.bankCode,
      bankName: tx.bankName,
      narration: `Billy Transfer From: ${user.firstName} ${user.lastName}`,
      debitAccountNumber: user.virtualAccount,
      reference: `tx-${Date.now()}`,
      sessionId: `${phone}-${Date.now()}`,
    });

    await this.cache.delete(`tx:${phone}`);

    return await this.whatsapp.sendText(
      phone,
      `✅ *Transfer Successful!*\n\n` +
        `₦${tx.amount} sent to ${tx.accountName} (${tx.accountNumber})\n` +
        `${tx.bankName}.`
    );
  }



  // async startTransferFlow(user: any, msg: any) {
  //   const phone = user.phoneNumber;
  //   const raw = msg.text?.body || '';
  //   const parsed = this.parser.parse(raw);

  //   if (!parsed.amount || !parsed.accountNumber) {
  //     return await this.whatsapp.sendText(
  //       phone,
  //       `❗ Please use:\n*Transfer 5000 to 0022334455 GTBank*`
  //     );
  //   }

  //   const banks = await this.bankResolver.resolveBank(raw, parsed.accountNumber);

  //   if (!banks.length) {
  //     return await this.whatsapp.sendText(phone, `❗ I couldn't detect the bank. Please specify it.`);
  //   }

  //   if (banks.length > 1) {
  //     return await this.whatsapp.sendText(
  //       phone,
  //       `❗ Multiple banks detected: ${banks.map((b) => b.bankName).join(', ')}`,
  //     );
  //   }

  //   const bank = banks[0];

  //   const enquiry = await this.rubies.nameEnquiry(bank.bankCode, parsed.accountNumber);

  //   if (enquiry?.data?.responseCode !== '00') {
  //     throw new BadRequestException('Invalid account number.');
  //   }

  //   const info = {
  //     amount: parsed.amount,
  //     accountNumber: parsed.accountNumber,
  //     bankCode: bank.bankCode,
  //     bankName: bank.bankName,
  //     accountName: enquiry.data.accountName,
  //   };

  //   await this.cache.set(`pending_transfer:${phone}`, info, 180);

  //   return await this.whatsapp.sendText(
  //     phone,
  //     `💰 Confirm Transfer\n\n` +
  //       `• *Amount:* ₦${info.amount.toLocaleString()}\n` +
  //       `• *Account:* ${info.accountNumber}\n` +
  //       `• *Bank:* ${info.bankName}\n` +
  //       `• *Name:* ${info.accountName}\n\n` +
  //       `Enter your *4-digit PIN* to confirm.`
  //   );
  // }

  /* -------------------------------------------------------------------------- */
  /*                         4. AIRTIME PURCHASE FLOW                            */
  /* -------------------------------------------------------------------------- */

  async startAirtimeFlow(user: any, msg: any) {
    const phone = user.phoneNumber;
    const text = msg.text?.body.toLowerCase();

    const regex = /airtime\s+(\d+|\d+k)\s+(\d{11})/i;
    const m = text.match(regex);

    if (!m) {
      return await this.whatsapp.sendText(
        phone,
        `📱 Airtime Purchase Format:\n\n*airtime 1000 08123456789*`
      );
    }

    let amount = m[1];
    if (amount.endsWith('k')) amount = parseInt(amount) * 1000;
    const targetPhone = m[2];

    await this.cache.set(
      `pending_airtime:${phone}`,
      { amount, targetPhone },
      180,
    );

    return await this.whatsapp.sendText(
      phone,
      `📱 Confirm Airtime Purchase\n\n` +
        `• *Amount:* ₦${amount}\n` +
        `• *Phone:* ${targetPhone}\n\n` +
        `Enter your *PIN* to confirm.`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                            5. BILLS PAYMENT FLOW                            */
  /* -------------------------------------------------------------------------- */

  async startBillsFlow(user: any, msg: any) {
    const phone = user.phoneNumber;
    const text = msg.text?.body.toLowerCase();

    const regex = /(dstv|gotv|electricity|ikeja|abuja)\s+(\d+)\s+(\w+)/i;
    const m = text.match(regex);

    if (!m) {
      return await this.whatsapp.sendText(
        phone,
        `💡 Bill Payment Format:\n\n*dstv 11500 7032482829*`
      );
    }

    const biller = m[1];
    const amount = parseInt(m[2]);
    const customerId = m[3];

    await this.cache.set(
      `pending_bill:${phone}`,
      { biller, amount, customerId },
      180,
    );

    return await this.whatsapp.sendText(
      phone,
      `💡 Confirm Bill Payment\n\n` +
        `• *Biller:* ${biller.toUpperCase()}\n` +
        `• *Amount:* ₦${amount}\n` +
        `• *Customer ID:* ${customerId}\n\n` +
        `Enter your *PIN* to confirm.`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                            6. CRYPTO TRADING FLOW                           */
  /* -------------------------------------------------------------------------- */

  async startCryptoFlow(user: any, msg: any) {
    const phone = user.phoneNumber;
    const text = msg.text?.body.toLowerCase();

    const regex = /(buy|sell)\s+(\d+)\s+(usdt|btc|eth)/i;
    const m = text.match(regex);

    if (!m) {
      return await this.whatsapp.sendText(
        phone,
        `🪙 Crypto Format:\n*buy 50 usdt*\n*sell 20 usdt*`
      );
    }

    const side = m[1];
    const amount = parseFloat(m[2]);
    const asset = m[3].toUpperCase();

    await this.cache.set(
      `pending_crypto:${phone}`,
      { side, amount, asset },
      180,
    );

    return await this.whatsapp.sendText(
      phone,
      `🪙 Confirm Crypto Trade\n\n` +
        `• Action: *${side.toUpperCase()}*\n` +
        `• Amount: *${amount} ${asset}*\n\n` +
        `Enter your *PIN* to confirm.`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                            7. GET WALLET BALANCE                            */
  /* -------------------------------------------------------------------------- */

  async getWalletBalance(phone: string, messageId: string) {
    const user = await this.userService.findByPhone(phone);

    await this.whatsapp.sendTypingIndicator(phone,messageId);
    await this.delay(500);

    return await this.whatsapp.sendText(
      phone,
      `💼 *Wallet Balance*\n\n` +
        `💰 *₦${(user.balance ?? 0).toLocaleString()}*\n\n` +
        `Type *menu* to continue.`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                       8. PIN VERIFICATION + EXECUTION                       */
  /* -------------------------------------------------------------------------- */

  async handlePinAuth(user: any, msg: any) {
    const phone = user.phoneNumber;
    const pin = msg.text?.body.trim();

    const isValid = await bcrypt.compare(pin, user.pinHash);
    if (!isValid) {
      return await this.whatsapp.sendText(phone, `❌ Incorrect PIN. Try again.`);
    }

    // --- Route to pending operations ---
    const pendingTransfer = await this.cache.get(`pending_transfer:${phone}`);
    if (pendingTransfer) return await this.executeTransfer(user, pendingTransfer);

    const pendingAirtime = await this.cache.get(`pending_airtime:${phone}`);
    if (pendingAirtime) return await this.executeAirtime(user, pendingAirtime);

    const pendingBills = await this.cache.get(`pending_bill:${phone}`);
    if (pendingBills) return await this.executeBill(user, pendingBills);

    const pendingCrypto = await this.cache.get(`pending_crypto:${phone}`);
    if (pendingCrypto) return await this.executeCrypto(user, pendingCrypto);

    return await this.whatsapp.sendText(phone, `🤖 No action pending.`);
  }

  /* -------------------------------------------------------------------------- */
  /*                          9. EXECUTION: TRANSFER                             */
  /* -------------------------------------------------------------------------- */

  async executeTransfer(user: any, payload: any) {
    const phone = user.phoneNumber;

    if (user.balance < payload.amount) {
      return await this.whatsapp.sendText(phone, `❗ Insufficient balance.`);
    }

    const tx = await this.rubies.fundTransfer({
      amount: payload.amount,
      creditAccountName: payload.accountName,
      creditAccountNumber: payload.accountNumber,
      bankCode: payload.bankCode,
      bankName: payload.bankName,
      narration: `Billy Transfer`,
      debitAccountNumber: user.virtualAccount,
      reference: `tx-${Date.now()}`,
      sessionId: `${phone}-${Date.now()}`,
    });

    user.balance -= payload.amount;
    await this.userService.update(user.id, user);
    await this.cache.delete(`pending_transfer:${phone}`);

    return await this.whatsapp.sendText(
      phone,
      `✅ Transfer Successful!\n\n` +
        `Sent *₦${payload.amount.toLocaleString()}* to *${payload.accountName}* (${payload.accountNumber})\n` +
        `Bank: ${payload.bankName}\n\n` +
        `Type *save* to add this beneficiary.`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                          10. EXECUTION: AIRTIME                            */
  /* -------------------------------------------------------------------------- */

  async executeAirtime(user: any, pending: any) {
    const phone = user.phoneNumber;

    // TODO integrate VAS API
    user.balance -= pending.amount;
    await this.userService.update(user.id, user);
    await this.cache.delete(`pending_airtime:${phone}`);

    return await this.whatsapp.sendText(
      phone,
      `📱 Airtime Purchase Successful!\n\n` +
        `₦${pending.amount} was sent to ${pending.targetPhone}.`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                            11. EXECUTION: BILLS                             */
  /* -------------------------------------------------------------------------- */

  async executeBill(user: any, pending: any) {
    const phone = user.phoneNumber;

    user.balance -= pending.amount;
    await this.userService.update(user.id, user);
    await this.cache.delete(`pending_bill:${phone}`);

    return await this.whatsapp.sendText(
      phone,
      `💡 Bill Payment Successful!\n\n` +
        `Paid ₦${pending.amount} for ${pending.biller.toUpperCase()}.\n` +
        `Customer ID: ${pending.customerId}`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                            12. EXECUTION: CRYPTO                           */
  /* -------------------------------------------------------------------------- */

  async executeCrypto(user: any, pending: any) {
    const phone = user.phoneNumber;

    user.balance -= pending.amount * 1500; // sample conversion
    await this.userService.update(user.id, user);
    await this.cache.delete(`pending_crypto:${phone}`);

    return await this.whatsapp.sendText(
      phone,
      `🪙 Crypto Trade Successful!\n\n` +
        `${pending.side.toUpperCase()} ${pending.amount} ${pending.asset}.`
    );
  }
}