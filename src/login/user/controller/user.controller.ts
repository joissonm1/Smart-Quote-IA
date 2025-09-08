import { Controller, Get } from '@nestjs/common';
import { UserService } from '../service/user.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos usuários' })
  findAll() {
    return this.userService.findAll();
  }
}
