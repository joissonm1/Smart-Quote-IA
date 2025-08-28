import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { z } from 'zod';

const nameSchema = z.string().min(2, 'Nome deve ter pelo menos 2 caracteres');

const emailSchema = z.string().email('Email inválido');

const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .refine((val) => val.split('').some((c) => c >= 'A' && c <= 'Z'), {
    message: 'Senha deve conter pelo menos 1 letra maiúscula',
  })
  .refine((val) => val.split('').some((c) => c >= 'a' && c <= 'z'), {
    message: 'Senha deve conter pelo menos 1 letra minúscula',
  })
  .refine(
    (val) => {
      const allowed =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      return val.split('').some((c) => !allowed.includes(c));
    },
    { message: 'Senha deve conter pelo menos 1 símbolo' },
  )
  .refine((val) => val.split('').some((c) => !isNaN(Number(c))), {
    message: 'Senha deve conter pelo menos 1 número',
  });

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(name: string, email: string, password: string) {
    try {
      nameSchema.parse(name.trim());
      emailSchema.parse(email.trim().toLowerCase());
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new BadRequestException(
          err.errors.map((e) => e.message).join(', '),
        );
      }
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException('Email já está em uso');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: Role.MANAGER,
      },
    });
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
