import { Injectable } from '@nestjs/common';

export interface User {
  id: string;
  phoneNumber: string;
  fullName?: string;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  // TODO: replace with TypeORM / microservice call
  private readonly mockUsers: User[] = [];

  async findByPhone(phone: string): Promise<User | null> {
    return this.mockUsers.find((u) => u.phoneNumber === phone) || null;
  }

  async createFromFlow(phone: string, data: Record<string, any>): Promise<User> {
    const user: User = {
      id: `user_${Date.now()}`,
      phoneNumber: phone,
      fullName: data.full_name || data.name,
      createdAt: new Date(),
    };
    this.mockUsers.push(user);
    return user;
  }
}
