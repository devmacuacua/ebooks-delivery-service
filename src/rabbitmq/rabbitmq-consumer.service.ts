import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { DeliveryService } from '../delivery/delivery.service';

const EXCHANGE = 'ebooks.events';
const QUEUE = 'delivery-service-queue';

@Injectable()
export class RabbitMQConsumerService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQConsumerService.name);
  private channel: amqp.Channel;

  constructor(private readonly deliveryService: DeliveryService) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      const conn = await amqp.connect(process.env.RABBITMQ_URL!);
      this.channel = await conn.createChannel();

      await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(QUEUE, { durable: true });
      await this.channel.bindQueue(QUEUE, EXCHANGE, 'commerce.order.paid');

      this.channel.prefetch(5);
      this.channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          await this.handleOrderPaid(payload);
          this.channel.ack(msg);
        } catch (err) {
          this.logger.error('Failed to process message', err);
          this.channel.nack(msg, false, false);
        }
      });

      conn.on('error', () => this.reconnect());
      conn.on('close', () => this.reconnect());
      this.logger.log('Connected to RabbitMQ');
    } catch {
      this.logger.error('RabbitMQ connection failed, retrying in 5s');
      setTimeout(() => this.connect(), 5000);
    }
  }

  private reconnect() {
    this.logger.warn('RabbitMQ disconnected, reconnecting in 5s');
    setTimeout(() => this.connect(), 5000);
  }

  private async handleOrderPaid(payload: {
    orderId: string;
    orderNumber: string;
    userId: string;
    items: Array<{ type?: string; bookType?: string }>;
    deliveryAddress?: {
      recipientName: string;
      recipientPhone?: string;
      province: string;
      district: string;
      address: string;
      postalCode?: string;
    };
  }) {
    const hasPhysical = payload.items.some((i) => {
      const t = i.type ?? i.bookType;
      return t === 'PHYSICAL' || t === 'BOTH';
    });
    if (!hasPhysical || !payload.deliveryAddress) return;

    const addr = payload.deliveryAddress;

    try {
      const delivery = await this.deliveryService.createFromOrder({
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        recipientName: addr.recipientName,
        recipientPhone: addr.recipientPhone,
        province: addr.province,
        district: addr.district,
        address: addr.address,
        postalCode: addr.postalCode,
      });

      // Publish delivery created event for notification service
      await this.channel.publish(
        EXCHANGE,
        'delivery.created',
        Buffer.from(JSON.stringify({
          deliveryId: delivery.id,
          orderId: delivery.orderId,
          orderNumber: delivery.orderNumber,
          userId: delivery.userId,
          trackingCode: delivery.trackingCode,
          recipientName: delivery.recipientName,
          recipientPhone: delivery.recipientPhone,
          province: delivery.province,
          estimatedDelivery: delivery.estimatedDelivery,
        })),
        { persistent: true },
      );

      this.logger.log(`Delivery created: ${delivery.trackingCode} for order ${delivery.orderNumber}`);
    } catch (err) {
      this.logger.error(`Failed to create delivery for order ${payload.orderId}: ${err.message}`);
      throw err;
    }
  }

  async publishStatusUpdate(delivery: any) {
    if (!this.channel) return;
    await this.channel.publish(
      EXCHANGE,
      'delivery.status.updated',
      Buffer.from(JSON.stringify({
        deliveryId: delivery.id,
        orderId: delivery.orderId,
        userId: delivery.userId,
        trackingCode: delivery.trackingCode,
        status: delivery.status,
        province: delivery.province,
        recipientName: delivery.recipientName,
        recipientPhone: delivery.recipientPhone,
        estimatedDelivery: delivery.estimatedDelivery,
        deliveredAt: delivery.deliveredAt,
      })),
      { persistent: true },
    );
  }
}
