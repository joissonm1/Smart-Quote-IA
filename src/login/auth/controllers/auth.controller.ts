import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { ApiTags, ApiResponse, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar novo usuário' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Joisson' },
        email: { type: 'string', example: 'joisson@example.com' },
        password: { type: 'string', example: 'Strong@123' },
      },
      required: ['name', 'email', 'password'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Usuário registrado com sucesso',
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'joisson@example.com' },
        password: { type: 'string', example: 'Strong@123' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({ status: 200, description: 'Login bem-sucedido, retorna JWT' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    return this.authService.login(user);
  }
}
