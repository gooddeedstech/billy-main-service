import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappEventFilterService {
  private readonly logger = new Logger(WhatsappEventFilterService.name);

  // Ignore events older than 5 minutes
  private readonly MAX_EVENT_AGE_MS = 5 * 60 * 1000;

  isOldEvent(timestamp: number): boolean {
    const eventTimeMs = timestamp * 1000;
    const age = Date.now() - eventTimeMs;

    if (age > this.MAX_EVENT_AGE_MS) {
      this.logger.warn(`⏳ Ignoring old event (${Math.round(age / 1000)}s old)`);
      return true;
    }
    return false;
  }

  isBusinessAccountLockedEvent(change: any): boolean {
    const title = change?.value?.metadata?.title;
    if (title === 'Business Account locked') {
      this.logger.warn('🚫 Ignoring "Business Account locked" historical event');
      return true;
    }
    return false;
  }

  isDuplicate(eventId: string, cache: Set<string>): boolean {
    if (cache.has(eventId)) {
      this.logger.warn(`🔁 Duplicate event ignored: ${eventId}`);
      return true;
    }
    cache.add(eventId);
    return false;
  }
}