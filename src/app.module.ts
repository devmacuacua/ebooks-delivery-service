import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { ZoneService } from './zone/zone.service';
import { DeliveryService } from './delivery/delivery.service';
import { DeliveryController } from './delivery/delivery.controller';
import { RabbitMQConsumerService } from './rabbitmq/rabbitmq-consumer.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  controllers: [DeliveryController, HealthController],
  providers: [ZoneService, DeliveryService, RabbitMQConsumerService],
})
export class AppModule {}
