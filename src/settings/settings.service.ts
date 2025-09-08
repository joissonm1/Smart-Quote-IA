import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // SETTINGS BÁSICOS (ADMIN ONLY)
  // ==========================================

  // Buscar configurações atuais
  async getBasicSettings(userId: string) {
    // Verificar se é admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Acesso negado: Apenas administradores');
    }

    // Buscar configurações do sistema
    const systemSettings = await this.prisma.systemSettings.findFirst({
      where: { userId },
    });

    return {
      revisionThreshold: systemSettings?.revisionThreshold || 2000000,
      supervisorEmail:
        systemSettings?.supervisorEmail || process.env.SUPERVISOR_EMAIL,
      emailNotifications: systemSettings?.emailNotifications || true,
    };
  }

  // Atualizar valor de 2M e email do supervisor
  async updateBasicSettings(
    userId: string,
    data: {
      revisionThreshold?: number;
      supervisorEmail?: string;
      emailNotifications?: boolean;
    },
  ) {
    // Verificar se é admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Acesso negado: Apenas administradores');
    }

    this.logger.log(`Admin ${user.email} atualizando configurações básicas`);

    // Buscar ou criar configurações
    let systemSettings = await this.prisma.systemSettings.findFirst({
      where: { userId },
    });

    if (!systemSettings) {
      // Criar configurações se não existir
      systemSettings = await this.prisma.systemSettings.create({
        data: {
          id: randomUUID(),
          userId,
          autoApproveThreshold: 10000,
          approvalThreshold: 2000000,
          revisionThreshold: data.revisionThreshold || 2000000,
          supervisorEmail: data.supervisorEmail || process.env.SUPERVISOR_EMAIL,
          emailNotifications: data.emailNotifications ?? true,
          aiProcessingModel: 'gpt-4',
          autoProcessing: 'enabled',
          confidenceThreshold: 85.0,
        },
      });
    } else {
      // Atualizar configurações existentes
      systemSettings = await this.prisma.systemSettings.update({
        where: { id: systemSettings.id },
        data: {
          revisionThreshold:
            data.revisionThreshold ?? systemSettings.revisionThreshold,
          supervisorEmail:
            data.supervisorEmail ?? systemSettings.supervisorEmail,
          emailNotifications:
            data.emailNotifications ?? systemSettings.emailNotifications,
        },
      });
    }

    return {
      revisionThreshold: systemSettings.revisionThreshold,
      supervisorEmail: systemSettings.supervisorEmail,
      emailNotifications: systemSettings.emailNotifications,
      message: 'Configurações atualizadas com sucesso',
    };
  }

  // ==========================================
  // GESTÃO DE USUÁRIOS (ADMIN ONLY)
  // ==========================================

  // Listar todos os usuários
  async getAllUsers(adminUserId: string) {
    // Verificar se é admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Acesso negado: Apenas administradores');
    }

    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
  }

  // Alterar role de um usuário
  async changeUserRole(
    adminUserId: string,
    targetUserId: string,
    newRole: 'ADMIN' | 'MANAGER',
  ) {
    // Verificar se é admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Acesso negado: Apenas administradores');
    }

    // Verificar se o usuário alvo existe
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Não permitir que o admin mude o próprio role
    if (adminUserId === targetUserId) {
      throw new BadRequestException('Não é possível alterar o próprio role');
    }

    this.logger.log(
      `Admin ${admin.email} alterando role do usuário ${targetUser.email} para ${newRole}`,
    );

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    return {
      user: updatedUser,
      message: `Role do usuário ${targetUser.email} alterado para ${newRole}`,
    };
  }

  // Alterar senha de um usuário
  async changeUserPassword(
    adminUserId: string,
    targetUserId: string,
    newPassword: string,
  ) {
    // Verificar se é admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Acesso negado: Apenas administradores');
    }

    // Verificar se o usuário alvo existe
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log(
      `Admin ${admin.email} alterando senha do usuário ${targetUser.email}`,
    );

    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashedPassword },
    });

    return {
      message: `Senha do usuário ${targetUser.email} alterada com sucesso`,
    };
  }

  // Alterar nome de um usuário
  async changeUserName(
    adminUserId: string,
    targetUserId: string,
    data: {
      name?: string;
      firstName?: string;
      lastName?: string;
    },
  ) {
    // Verificar se é admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Acesso negado: Apenas administradores');
    }

    // Verificar se o usuário alvo existe
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log(
      `Admin ${admin.email} alterando nome do usuário ${targetUser.email}`,
    );

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        name: data.name ?? targetUser.name,
        firstName: data.firstName ?? targetUser.firstName,
        lastName: data.lastName ?? targetUser.lastName,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        updatedAt: true,
      },
    });

    return {
      user: updatedUser,
      message: `Nome do usuário ${targetUser.email} atualizado com sucesso`,
    };
  }
}
