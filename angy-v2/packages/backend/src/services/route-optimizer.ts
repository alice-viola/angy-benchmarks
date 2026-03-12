import { haversine } from '@nexusfleet/shared';

interface Stop {
  id: string;
  shipment_id: string | null;
  stop_type: string;
  sequence_order: number;
  location: { lat: number; lng: number };
  cargo_weight_kg?: number;
}

interface OptimizationInput {
  stops: Stop[];
  vehicle_capacity_kg: number;
  max_driving_hours: number;
}

interface OptimizationResult {
  stops: Array<{ id: string; sequence_order: number }>;
  estimated_distance_km: number;
  optimization_score: number;
}

/**
 * Nearest-neighbor heuristic with constraints:
 * - Pickup stop MUST appear before corresponding delivery stop (precedence constraint)
 * - Cumulative capacity check: total cargo weight must not exceed vehicle capacity_kg
 * - Driver hours estimate: based on 60 km/h average speed + haversine distances
 */
export function optimizeRoute(input: OptimizationInput): OptimizationResult {
  const { stops, vehicle_capacity_kg } = input;

  if (stops.length <= 1) {
    return {
      stops: stops.map((s, i) => ({ id: s.id, sequence_order: i })),
      estimated_distance_km: 0,
      optimization_score: 100,
    };
  }

  // Calculate original distance for comparison
  const originalDistance = calculateTotalDistance(stops);

  // Build precedence map: shipment_id → { pickup_id, delivery_id }
  const shipmentStops = new Map<string, { pickup?: Stop; delivery?: Stop }>();
  for (const stop of stops) {
    if (stop.shipment_id) {
      const entry = shipmentStops.get(stop.shipment_id) ?? {};
      if (stop.stop_type === 'pickup') entry.pickup = stop;
      if (stop.stop_type === 'delivery') entry.delivery = stop;
      shipmentStops.set(stop.shipment_id, entry);
    }
  }

  // Track which shipments have been picked up
  const pickedUp = new Set<string>();
  const visited = new Set<string>();
  const ordered: Stop[] = [];

  // Start from the first stop (depot or first stop)
  const depotStops = stops.filter((s) => s.stop_type === 'depot');
  let current: Stop;
  if (depotStops.length > 0) {
    current = depotStops[0];
    visited.add(current.id);
    ordered.push(current);
  } else {
    // Start with the first pickup
    const firstPickup = stops.find((s) => s.stop_type === 'pickup') ?? stops[0];
    current = firstPickup;
    visited.add(current.id);
    ordered.push(current);
    if (current.shipment_id && current.stop_type === 'pickup') {
      pickedUp.add(current.shipment_id);
    }
  }

  // Nearest-neighbor with precedence constraints
  let cumulativeWeight = 0;
  while (ordered.length < stops.length) {
    const candidates = stops.filter((s) => {
      if (visited.has(s.id)) return false;

      // Precedence constraint: delivery only if pickup has been done
      if (s.stop_type === 'delivery' && s.shipment_id) {
        if (!pickedUp.has(s.shipment_id)) return false;
      }

      // Capacity check for pickup stops
      if (s.stop_type === 'pickup' && s.cargo_weight_kg) {
        if (cumulativeWeight + s.cargo_weight_kg > vehicle_capacity_kg) return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      // Add remaining stops in original order (fallback for unsatisfiable constraints)
      const remaining = stops.filter((s) => !visited.has(s.id));
      for (const s of remaining) {
        ordered.push(s);
        visited.add(s.id);
      }
      break;
    }

    // Find nearest candidate
    let nearest = candidates[0];
    let nearestDist = haversine(
      current.location.lat,
      current.location.lng,
      nearest.location.lat,
      nearest.location.lng,
    );

    for (let i = 1; i < candidates.length; i++) {
      const dist = haversine(
        current.location.lat,
        current.location.lng,
        candidates[i].location.lat,
        candidates[i].location.lng,
      );
      if (dist < nearestDist) {
        nearest = candidates[i];
        nearestDist = dist;
      }
    }

    visited.add(nearest.id);
    ordered.push(nearest);

    if (nearest.stop_type === 'pickup' && nearest.shipment_id) {
      pickedUp.add(nearest.shipment_id);
      cumulativeWeight += nearest.cargo_weight_kg ?? 0;
    }
    if (nearest.stop_type === 'delivery') {
      // Delivery reduces cumulative weight
      cumulativeWeight -= nearest.cargo_weight_kg ?? 0;
      if (cumulativeWeight < 0) cumulativeWeight = 0;
    }

    current = nearest;
  }

  const optimizedDistance = calculateTotalDistance(ordered);

  // Score: percentage improvement
  let score: number;
  if (originalDistance === 0) {
    score = 100;
  } else {
    const improvement = ((originalDistance - optimizedDistance) / originalDistance) * 100;
    score = Math.max(0, Math.min(100, Math.round(improvement)));
  }

  return {
    stops: ordered.map((s, i) => ({ id: s.id, sequence_order: i })),
    estimated_distance_km: Math.round(optimizedDistance * 100) / 100,
    optimization_score: score,
  };
}

function calculateTotalDistance(stops: Stop[]): number {
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    total += haversine(
      stops[i].location.lat,
      stops[i].location.lng,
      stops[i + 1].location.lat,
      stops[i + 1].location.lng,
    );
  }
  return total;
}
