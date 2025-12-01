import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /** Save any object with optional TTL (seconds) */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    await this.cacheManager.set(key, JSON.stringify(value), ttlSeconds);
  }

  /** Retrieve and auto-parse JSON value */
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.cacheManager.get<string>(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value as any;
    }
  }

  /** Delete key */
  async delete(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /** Check if key exists */
  async exists(key: string): Promise<boolean> {
    const value = await this.cacheManager.get(key);
    return value !== undefined && value !== null;
  }

  /** Clear all Billy-related keys */
  async clearNamespace(prefix: string): Promise<void> {
    // Only works if you use 'redis' backend
    const client: any = (this.cacheManager as any).store.client;
    const keys = await client.keys(`${prefix}:*`);

    if (keys.length > 0) {
      await client.del(keys);
    }
  }
}