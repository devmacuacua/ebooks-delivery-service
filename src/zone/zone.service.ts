import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZoneService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.deliveryZone.findMany({ where: { active: true }, orderBy: { province: 'asc' } });
  }

  async findByProvince(province: string) {
    const zone = await this.prisma.deliveryZone.findFirst({ where: { province, active: true } });
    if (!zone) throw new NotFoundException(`Sem entrega disponível para: ${province}`);
    return zone;
  }

  estimatedDeliveryDate(daysMin: number, daysMax: number): Date {
    const avg = Math.ceil((daysMin + daysMax) / 2);
    const date = new Date();
    date.setDate(date.getDate() + avg);
    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
    return date;
  }
}
