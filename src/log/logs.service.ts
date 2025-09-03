import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createLog(
    userId: string | null,
    action: string,
    details: Record<string, any>,
  ) {
    this.logger.log(`Registro de log: ${action}`);
    return this.prisma.log.create({
      data: {
        userId,
        action,
        details,
      },
    });
  }

  async getAllLogs() {
    return this.prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
