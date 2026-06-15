import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/decorators/auth.decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOkResponse({ description: 'API health status.' })
  getHealth() {
    return {
      status: 'ok',
      service: 'process-discovery-api',
      timestamp: new Date().toISOString(),
    };
  }
}
