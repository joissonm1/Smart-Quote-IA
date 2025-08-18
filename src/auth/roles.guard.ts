// src/auth/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // Se não tiver roles definidas, qualquer um pode acessar
    }

    const { user } = context.switchToHttp().getRequest();
    
    console.log('User in guard:', user);
    if (!user) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Acesso negado. Permissão insuficiente.');
    }

    return requiredRoles.includes(user.role);
  }
}
