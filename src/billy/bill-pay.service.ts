// import { Injectable } from "@nestjs/common";

// @Injectable()
// export class BillPayService {
//   constructor(
//     private readonly parser: MessageParserService,
//     private readonly resolver: BankResolverService,
//     private readonly rubies: RubiesService,
//     private readonly userRepo: Repository<OnboardingUser>,
//     private readonly txnRepo: Repository<UserTransaction>,
//     private readonly beneficiaryRepo: Repository<UserBeneficiary>,
//     private readonly whatsapp: WhatsappApiService
//   ) {}

//   async processPaymentMessage(phone: string, message: string) {
//     // 1. Parse intent
//     const data = this.parser.parse(message);

//     if (!data.amount)
//       return this.whatsapp.sendText(phone, "❌ I couldn't detect the amount.");

//     if (!data.accountNumber)
//       return this.whatsapp.sendText(phone, "❌ I couldn’t detect the account number.");

//     // 2. Resolve bank candidates
//     const banks = await this.resolver.resolveBank(message, data.accountNumber);

//     if (!banks.length) {
//       return this.whatsapp.sendText(phone,
//         "⚠️ I could not identify the bank. Please specify the bank name."
//       );
//     }

//     // If multiple possible banks → ask user to confirm
//     if (banks.length > 1) {
//       let options = banks.map((b, i) => `${i + 1}. ${b.bankCode}`).join("\n");
//       return this.whatsapp.sendText(phone,
//         `I found multiple matching banks:\n\n${options}\n\nReply with the number of your bank.`
//       );
//     }

//     const selectedBank = banks[0].bankCode;

//     // 3. Confirm account holder name
//     const enquiry = await this.rubies.nameEnquiry(selectedBank, data.accountNumber);

//     if (enquiry.responseCode !== '00') {
//       return this.whatsapp.sendText(phone, "❌ Invalid account details.");
//     }

//     const accountName = enquiry.accountName;

//     // 4. Ask user to confirm transfer
//     await this.whatsapp.sendText(phone,
//       `💸 *Confirm Transfer*\n\nAmount: ₦${data.amount}\nTo: ${accountName}\nAcct No: ${data.accountNumber}\nBank: ${selectedBank}\n\nReply *YES* to continue or *NO* to cancel.`
//     );

//     // (Your webhook will capture YES/NO)
//     return {
//       pending: true,
//       type: 'awaiting_confirmation',
//       amount: data.amount,
//       account: data.accountNumber,
//       bank: selectedBank,
//       accountName,
//     };
//   }

//   /** After user replies YES */
//   async completeTransfer(phone: string, session: any) {
//     const user = await this.userRepo.findOne({ where: { phoneNumber: phone } });

//     const dto = {
//       amount: session.amount.toString(),
//       accountNumber: session.account,
//       accountBankCode: session.bank,
//       narration: "Billy Transfer",
//       reference: `BILLY-TX-${Date.now()}`,
//       debitAccount: user.virtualAccount,
//     };

//     // 5. Execute transfer
//     const res = await this.rubies.fundTransfer(dto);

//     if (res.responseCode !== '00') {
//       return this.whatsapp.sendText(phone, "❌ Transfer failed. Please try again.");
//     }

//     // 6. Save beneficiary
//     await this.beneficiaryRepo.save({
//       user,
//       number: session.account,
//       type: 'bank',
//       data: { bankCode: session.bank, accountName: session.accountName }
//     });

//     // 7. Save transaction
//     await this.txnRepo.save({
//       user,
//       type: 'DR',
//       amount: session.amount,
//       description: "Billy Bank Transfer",
//     });

//     // 8. Notify user
//     return this.whatsapp.sendText(phone,
//       `✅ *Transfer Successful!*\n\n₦${session.amount} sent to ${session.accountName}.\nRef: ${res.reference}`
//     );
//   }
// }