// import { Injectable, Logger } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { RubiesWebhookEvent } from '@/entities/rubies-webhook-event.entity';
// import { User } from '@/entities/user.entity';
// import { RubiesWebhookDto } from '../dto/rubies-webhook.dto';

// @Injectable()
// export class RubiesWebhookService {
//   private readonly logger = new Logger(RubiesWebhookService.name);

//   constructor(
//     @InjectRepository(RubiesWebhookEvent)
//     private readonly eventRepo: Repository<RubiesWebhookEvent>,
//     @InjectRepository(User)
//     private readonly userRepo: Repository<User>,
//     private readonly ledger: TransactionLedgerService, // optional but recommended
//   ) {}

//   async processWebhook(dto: RubiesWebhookDto) {
//     // ✅ 1. Idempotency check
//     const existing = await this.eventRepo.findOne({
//       where: { sessionId: dto.sessionId },
//     });
//     if (existing?.processed) {
//       this.logger.log(
//         `♻️ Rubies webhook already processed: sessionId=${dto.sessionId}`,
//       );
//       return { ok: true, alreadyProcessed: true };
//     }

//     // Save raw event (if new)
//     const event =
//       existing ??
//       this.eventRepo.create({
//         sessionId: dto.sessionId,
//         paymentReference: dto.paymentReference,
//         payload: dto as any,
//         processed: false,
//       });
//     if (!existing) await this.eventRepo.save(event);

//     // ✅ 2. Basic validation
//     if (dto.responseCode !== '00' || dto.responseMessage !== 'SUCCESSFUL') {
//       this.logger.warn(
//         `⚠️ Non-successful transaction from Rubies: responseCode=${dto.responseCode}`,
//       );
//       event.processed = true;
//       await this.eventRepo.save(event);
//       return { ok: false, reason: 'Not successful' };
//     }

//     // ✅ 3. Resolve which user this transaction belongs to
//     //    Assuming creditAccount is mapped to User.virtualAccountNumber
//     const user = await this.userRepo.findOne({
//       where: { virtualAccountNumber: dto.creditAccount },
//     });

//     if (!user) {
//       this.logger.error(
//         `❌ No user found for virtual account ${dto.creditAccount}`,
//       );
//       // You might still mark as processed to avoid endless retries,
//       // or keep processed=false and handle later manually.
//       return { ok: false, reason: 'User not found' };
//     }

//     const amount = Number(dto.amount || 0);

//     // ✅ 4. Credit internal ledger / wallet
//     try {
//       await this.ledger.credit({
//         userId: user.id,
//         amount,
//         description: `Rubies transfer: ${dto.narration} (${dto.paymentReference})`,
//       });

//       // You may also credit the user wallet record here if you maintain balances.

//       event.processed = true;
//       await this.eventRepo.save(event);

//       this.logger.log(
//         `✅ Rubies webhook processed for user ${user.email}, amount=${amount}`,
//       );
//       return { ok: true };
//     } catch (e: any) {
//       this.logger.error(
//         `❌ Failed to credit ledger for Rubies webhook: ${e.message}`,
//       );
//       // keep processed = false so you can retry
//       throw e;
//     }
//   }
// }