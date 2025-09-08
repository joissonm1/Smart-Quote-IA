import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':userId')
  async getSettings(@Param('userId') userId: string) {
    return this.settingsService.getSettings(userId);
  }

  @Patch(':userId')
  async updateSettings(
    @Param('userId') userId: string,
    @Body() data: Partial<any>,
  ) {
    return this.settingsService.updateSettings(userId, data);
  }
}
