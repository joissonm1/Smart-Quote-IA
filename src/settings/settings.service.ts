import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string) {
    return this.prisma.systemSettings.findUnique({
      where: { userId },
    });
  }

  async updateSettings(userId: string, data: Partial<any>) {
    this.logger.log(`Atualizando settings do usuário ${userId}`);
    return this.prisma.systemSettings.update({
      where: { userId },
      data,
    });
  }

  async createDefaultSettings(userId: string) {
    return this.prisma.systemSettings.create({
      data: {
        id: randomUUID(),
        userId,
        autoApproveThreshold: 0,
        approvalThreshold: 0,
        revisionThreshold: 2000000,
        supervisorEmail: 'supervisorteste.rcs@gmail.com',
        emailNotifications: true,
        aiProcessingModel: 'gpt-4',
        autoProcessing: 'enabled',
        confidenceThreshold: 85.0,
      },
    });
  }
}
