import type { Redis } from 'ioredis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationData {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: string;
}

export interface VehicleLocation {
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const vehicleLocationKey = (vehicleId: string) => `vehicle_location:${vehicleId}`;
const dirtyVehiclesKey = (tenantId: string) => `dirty_vehicles:${tenantId}`;
const trackingChannel = (tenantId: string) => `tracking:${tenantId}`;
const tenantVehiclesKey = (tenantId: string) => `tenant_vehicles:${tenantId}`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TrackingService {
  constructor(private redis: Redis) {}

  async processLocationUpdate(
    vehicleId: string,
    tenantId: string,
    data: LocationData,
  ): Promise<void> {
    if (data.lat < -90 || data.lat > 90) throw new Error('Invalid latitude');
    if (data.lng < -180 || data.lng > 180) throw new Error('Invalid longitude');

    const locationHash: Record<string, string> = {
      vehicleId,
      lat: String(data.lat),
      lng: String(data.lng),
      speed: String(data.speed ?? 0),
      heading: String(data.heading ?? 0),
      accuracy: String(data.accuracy ?? 0),
      timestamp: data.timestamp,
    };

    const pipeline = this.redis.pipeline();
    pipeline.hset(vehicleLocationKey(vehicleId), locationHash);
    pipeline.expire(vehicleLocationKey(vehicleId), 86_400); // 24h TTL
    pipeline.sadd(dirtyVehiclesKey(tenantId), vehicleId);
    pipeline.expire(dirtyVehiclesKey(tenantId), 300); // 5min TTL
    pipeline.sadd(tenantVehiclesKey(tenantId), vehicleId);
    pipeline.publish(
      trackingChannel(tenantId),
      JSON.stringify({ type: 'location_update', ...locationHash }),
    );
    await pipeline.exec();
  }

  async getVehicleLocation(vehicleId: string): Promise<VehicleLocation | null> {
    const data = await this.redis.hgetall(vehicleLocationKey(vehicleId));
    if (!data || !data.lat) return null;

    return {
      vehicleId: data.vehicleId ?? vehicleId,
      lat: Number(data.lat),
      lng: Number(data.lng),
      speed: Number(data.speed ?? 0),
      heading: Number(data.heading ?? 0),
      accuracy: Number(data.accuracy ?? 0),
      timestamp: data.timestamp ?? '',
    };
  }

  async getAllVehicleLocations(tenantId: string): Promise<VehicleLocation[]> {
    const vehicleIds = await this.redis.smembers(tenantVehiclesKey(tenantId));
    if (vehicleIds.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of vehicleIds) {
      pipeline.hgetall(vehicleLocationKey(id));
    }

    const results = await pipeline.exec();
    if (!results) return [];

    const locations: VehicleLocation[] = [];
    for (let i = 0; i < results.length; i++) {
      const [err, data] = results[i] as [Error | null, Record<string, string>];
      if (err || !data || !data.lat) continue;

      locations.push({
        vehicleId: data.vehicleId ?? vehicleIds[i],
        lat: Number(data.lat),
        lng: Number(data.lng),
        speed: Number(data.speed ?? 0),
        heading: Number(data.heading ?? 0),
        accuracy: Number(data.accuracy ?? 0),
        timestamp: data.timestamp ?? '',
      });
    }

    return locations;
  }
}
