import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(name: string, email: string, password: string) {
    if (!name || name.trim().length < 2) {
      throw new BadRequestException('Nome deve ter pelo menos 2 caracteres');
    }

    email = email.toLowerCase().trim();

    if (!this.isValidEmail(email)) {
      throw new BadRequestException('Email inválido');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email já está em uso');
    }

    if (!this.isStrongPassword(password)) {
      throw new BadRequestException(
        'Senha deve ter no mínimo 8 caracteres, incluindo 1 letra maiúscula, 1 minúscula, 1 número e 1 símbolo',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        name: name.trim(),
        email,
        password: hashedPassword,
        role: Role.ADMIN,
      },
    });
  }

  private isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  private isStrongPassword(password: string): boolean {
    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
