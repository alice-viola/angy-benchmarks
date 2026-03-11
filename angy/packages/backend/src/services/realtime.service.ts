import { redis } from '../lib/redis.js';

export async function publishVehicleLocation(tenantId: string, data: unknown): Promise<void> {
  await redis.publish(`tracking:${tenantId}`, JSON.stringify(data));
}

export async function publishShipmentUpdate(tenantId: string, data: unknown): Promise<void> {
  await redis.publish(`shipment_updates:${tenantId}`, JSON.stringify(data));
}

export async function publishAlert(tenantId: string, data: unknown): Promise<void> {
  await redis.publish(`alerts:${tenantId}`, JSON.stringify(data));
}
