import { Controller, Get, Res } from '@nestjs/common';
import { LogsService } from './logs.service';
import type { Response } from 'express';
import { ApiResponse, ApiOperation } from '@nestjs/swagger';
import { Parser } from 'json2csv';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('export/csv')
  @ApiOperation({ summary: 'Obter os logs em csv para download' })
  @ApiResponse({
    status: 200,
    description: 'Lista de logs em formato csv para download',
  })
  async exportCsv(@Res() res: Response) {
    const logs = await this.logsService.getAllLogs();
    const fields = ['id', 'userId', 'action', 'details', 'createdAt'];
    const parser = new Parser({ fields });
    const csv = parser.parse(logs);

    res.header('Content-Type', 'text/csv');
    res.attachment('logs.csv');
    res.send(csv);
  }

  @Get('export/json')
  @ApiOperation({ summary: 'Obter os logs em json' })
  @ApiResponse({
    status: 200,
    description: 'Lista de logs em formato json',
  })
  async exportJson(@Res() res: Response) {
    const logs = await this.logsService.getAllLogs();
    res.json(logs);
  }
}
