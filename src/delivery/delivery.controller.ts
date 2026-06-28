import {
  Body, Controller, ForbiddenException, Get, Param,
  Patch, Query, Req,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { DeliveryStatus } from '@prisma/client';
import { RabbitMQConsumerService } from '../rabbitmq/rabbitmq-consumer.service';

@Controller('deliveries')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly rabbitMQ: RabbitMQConsumerService,
  ) {}

  // ─── Customer endpoints ──────────────────────────────────────────────────────

  @Get('track/:trackingCode')
  track(@Param('trackingCode') trackingCode: string) {
    return this.deliveryService.findByTracking(trackingCode);
  }

  @Get('order/:orderId')
  byOrder(@Req() req, @Param('orderId') orderId: string) {
    return this.deliveryService.findByOrderId(orderId);
  }

  @Get('my')
  myDeliveries(
    @Req() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const userId = req.headers['x-user-id'];
    return this.deliveryService.findByUserId(userId, +page, +limit);
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────────

  @Get('admin')
  adminList(
    @Req() req,
    @Query('status') status?: DeliveryStatus,
    @Query('province') province?: string,
    @Query('page') page = 0,
    @Query('size') size = 20,
  ) {
    this.requireAdmin(req);
    return this.deliveryService.adminList(status, province, +page, +size);
  }

  @Get('admin/summary')
  summary(@Req() req) {
    this.requireAdmin(req);
    return this.deliveryService.summary();
  }

  @Patch('admin/:id/status')
  async updateStatus(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    this.requireAdmin(req);
    const updated = await this.deliveryService.updateStatus(id, dto, req.headers['x-user-id']);
    await this.rabbitMQ.publishStatusUpdate(updated);
    return updated;
  }

  private requireAdmin(req: any) {
    if (req.headers['x-user-role'] !== 'ADMIN') throw new ForbiddenException();
  }
}
