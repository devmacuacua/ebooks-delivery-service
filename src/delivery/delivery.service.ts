import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZoneService } from '../zone/zone.service';
import { manualProvider } from '../courier/providers/manual.provider';
import { DeliveryStatus } from '@prisma/client';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoneService: ZoneService,
  ) {}

  async createFromOrder(payload: {
    orderId: string;
    orderNumber: string;
    userId: string;
    recipientName: string;
    recipientPhone?: string;
    province: string;
    district: string;
    address: string;
    postalCode?: string;
  }) {
    const zone = await this.zoneService.findByProvince(payload.province);
    const trackingCode = manualProvider.generateTrackingCode();
    const estimatedDelivery = this.zoneService.estimatedDeliveryDate(
      zone.estimatedDaysMin,
      zone.estimatedDaysMax,
    );

    const delivery = await this.prisma.delivery.create({
      data: {
        ...payload,
        zoneId: zone.id,
        trackingCode,
        estimatedDelivery,
        status: DeliveryStatus.PENDING,
      },
    });

    await this.prisma.deliveryEvent.create({
      data: {
        deliveryId: delivery.id,
        status: DeliveryStatus.PENDING,
        description: 'Entrega registada. A aguardar processamento.',
      },
    });

    return delivery;
  }

  async findByTracking(trackingCode: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { trackingCode },
      include: { zone: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!delivery) throw new NotFoundException('Código de rastreio não encontrado');
    return delivery;
  }

  async findByOrderId(orderId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { orderId },
      include: { zone: true, events: { orderBy: { createdAt: 'desc' } } },
    });
    if (!delivery) throw new NotFoundException('Entrega não encontrada');
    return delivery;
  }

  async findByUserId(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return this.prisma.delivery.findMany({
      where: { userId },
      include: { zone: { select: { province: true, fee: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async updateStatus(deliveryId: string, dto: UpdateStatusDto, updatedBy = 'admin') {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Entrega não encontrada');

    const [updated] = await this.prisma.$transaction([
      this.prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: dto.status,
          deliveredAt: dto.status === DeliveryStatus.DELIVERED ? new Date() : undefined,
        },
        include: { events: false },
      }),
      this.prisma.deliveryEvent.create({
        data: {
          deliveryId,
          status: dto.status,
          description: dto.description,
          location: dto.location,
          createdBy: updatedBy,
        },
      }),
    ]);

    return updated;
  }

  async adminList(status?: DeliveryStatus, province?: string, page = 0, size = 20) {
    const where: any = {};
    if (status) where.status = status;
    if (province) where.province = { contains: province, mode: 'insensitive' };

    const skip = page * size;
    const [items, total] = await Promise.all([
      this.prisma.delivery.findMany({
        where,
        include: { zone: { select: { province: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.delivery.count({ where }),
    ]);

    const totalPages = Math.ceil(total / size);
    return {
      content: items,
      totalElements: total,
      totalPages,
      page,
      size,
      last: page >= totalPages - 1,
    };
  }

  async summary() {
    const statuses = Object.values(DeliveryStatus);
    const counts = await Promise.all(
      statuses.map((s) => this.prisma.delivery.count({ where: { status: s } })),
    );
    return Object.fromEntries(statuses.map((s, i) => [s, counts[i]]));
  }
}
