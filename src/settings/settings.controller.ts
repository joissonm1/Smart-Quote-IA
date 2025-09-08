import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('basic/:adminId')
  @ApiOperation({
    summary: 'Admin: Buscar configurações básicas (2M, supervisor email)',
  })
  async getBasicSettings(@Param('adminId') adminId: string) {
    return this.settingsService.getBasicSettings(adminId);
  }

  @Patch('basic/:adminId')
  @ApiOperation({
    summary: 'Admin: Atualizar configurações básicas (2M, supervisor email)',
  })
  async updateBasicSettings(
    @Param('adminId') adminId: string,
    @Body() data: any,
  ) {
    return this.settingsService.updateBasicSettings(adminId, data);
  }

  @Get('users/:adminId')
  @ApiOperation({
    summary: 'Admin: Listar todos os usuários',
  })
  async getAllUsers(@Param('adminId') adminId: string) {
    return this.settingsService.getAllUsers(adminId);
  }

  @Patch('users/:adminId/:userId/role')
  @ApiOperation({
    summary: 'Admin: Alterar role de um usuário',
  })
  async changeUserRole(
    @Param('adminId') adminId: string,
    @Param('userId') userId: string,
    @Body() data: any,
  ) {
    return this.settingsService.changeUserRole(adminId, userId, data.role);
  }

  @Patch('users/:adminId/:userId/password')
  @ApiOperation({
    summary: 'Admin: Alterar senha de um usuário',
  })
  async changeUserPassword(
    @Param('adminId') adminId: string,
    @Param('userId') userId: string,
    @Body() data: any,
  ) {
    return this.settingsService.changeUserPassword(
      adminId,
      userId,
      data.newPassword,
    );
  }

  @Patch('users/:adminId/:userId/name')
  @ApiOperation({
    summary: 'Admin: Alterar nome de um usuário',
  })
  async changeUserName(
    @Param('adminId') adminId: string,
    @Param('userId') userId: string,
    @Body() data: any,
  ) {
    return this.settingsService.changeUserName(adminId, userId, data);
  }
}
