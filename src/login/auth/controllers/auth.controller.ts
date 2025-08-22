import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar novo usuário' })
  @ApiResponse({
    status: 201,
    description: 'Usuário registrado com sucesso',
    schema: {
      example: {
        id: 'cku9gk29s0000v5l8h5q6h2d1',
        name: 'Joisson',
        email: 'joisson@example.com',
        password: '$2b$10$hashAqui...',
        role: 'ADMIN',
        createdAt: '2025-08-20T12:34:56.789Z',
        updatedAt: '2025-08-20T12:34:56.789Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Erro de validação' })
  register(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login e obtenção de token JWT' })
  @ApiResponse({ status: 200, description: 'Login bem-sucedido, retorna JWT' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    return this.authService.login(user);
  }
}
