CREATE TYPE "DeliveryStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'PICKED_UP', 'IN_TRANSIT',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'
);

CREATE TABLE "delivery_zones" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "province"          VARCHAR(100) NOT NULL,
    "fee"               DECIMAL(10,2) NOT NULL,
    "estimatedDaysMin"  INTEGER      NOT NULL,
    "estimatedDaysMax"  INTEGER      NOT NULL,
    "active"            BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_zones_province_key" ON "delivery_zones"("province");

-- Seed: 11 províncias de Moçambique
INSERT INTO "delivery_zones" ("province", "fee", "estimatedDaysMin", "estimatedDaysMax") VALUES
  ('Cidade de Maputo',   150.00, 1, 2),
  ('Província de Maputo',200.00, 2, 3),
  ('Gaza',               350.00, 3, 5),
  ('Inhambane',          400.00, 3, 5),
  ('Sofala',             450.00, 4, 6),
  ('Manica',             500.00, 4, 6),
  ('Tete',               550.00, 5, 7),
  ('Zambézia',           550.00, 5, 7),
  ('Nampula',            600.00, 6, 8),
  ('Cabo Delgado',       700.00, 7, 10),
  ('Niassa',             700.00, 7, 10);

CREATE TABLE "deliveries" (
    "id"                UUID            NOT NULL DEFAULT gen_random_uuid(),
    "orderId"           VARCHAR(255)    NOT NULL,
    "orderNumber"       VARCHAR(50)     NOT NULL,
    "userId"            VARCHAR(255)    NOT NULL,
    "recipientName"     VARCHAR(255)    NOT NULL,
    "recipientPhone"    VARCHAR(50)     NOT NULL,
    "province"          VARCHAR(100)    NOT NULL,
    "district"          VARCHAR(100)    NOT NULL,
    "address"           TEXT            NOT NULL,
    "postalCode"        VARCHAR(20),
    "zoneId"            UUID            NOT NULL,
    "courier"           VARCHAR(50)     NOT NULL DEFAULT 'manual',
    "trackingCode"      VARCHAR(100)    NOT NULL,
    "status"            "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedDelivery" DATE,
    "deliveredAt"       TIMESTAMP(3),
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deliveries_orderId_key"     ON "deliveries"("orderId");
CREATE UNIQUE INDEX "deliveries_trackingCode_key" ON "deliveries"("trackingCode");
CREATE INDEX "deliveries_userId_idx"             ON "deliveries"("userId");
CREATE INDEX "deliveries_status_idx"             ON "deliveries"("status");

ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_zoneId_fkey"
    FOREIGN KEY ("zoneId") REFERENCES "delivery_zones"("id");

CREATE TABLE "delivery_events" (
    "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
    "deliveryId"  UUID            NOT NULL,
    "status"      "DeliveryStatus" NOT NULL,
    "description" TEXT,
    "location"    VARCHAR(255),
    "createdBy"   VARCHAR(100)    NOT NULL DEFAULT 'system',
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_events_deliveryId_idx" ON "delivery_events"("deliveryId");

ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_deliveryId_fkey"
    FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE;
