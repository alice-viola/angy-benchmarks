export const SHIPMENT_STATUSES = [
  'draft',
  'confirmed',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'completed',
  'failed',
  'cancelled',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const TERMINAL_STATUSES: readonly ShipmentStatus[] = ['cancelled', 'completed'] as const;

/**
 * Shipment state transition map.
 * Keys are `{from}:{to}` pairs. Values describe the valid transition.
 * Includes `failed:confirmed` for retry.
 */
export const SHIPMENT_TRANSITIONS: Record<string, { action: string; description: string }> = {
  'draft:confirmed': { action: 'confirm', description: 'Confirm shipment' },
  'draft:cancelled': { action: 'cancel', description: 'Cancel draft shipment' },
  'confirmed:assigned': { action: 'assign', description: 'Assign vehicle and driver' },
  'confirmed:cancelled': { action: 'cancel', description: 'Cancel confirmed shipment' },
  'assigned:picked_up': { action: 'pickup', description: 'Mark as picked up' },
  'assigned:cancelled': { action: 'cancel', description: 'Cancel assigned shipment' },
  'picked_up:in_transit': { action: 'auto', description: 'Auto-transition after pickup' },
  'in_transit:delivered': { action: 'deliver', description: 'Mark as delivered' },
  'in_transit:failed': { action: 'fail', description: 'Mark delivery as failed' },
  'delivered:completed': { action: 'complete', description: 'Mark as completed' },
  'failed:confirmed': { action: 'retry', description: 'Retry failed shipment' },
};

/** Map from action name to the transition it triggers */
export const ACTION_TO_TRANSITION: Record<string, { from: ShipmentStatus; to: ShipmentStatus }> = {
  confirm: { from: 'draft', to: 'confirmed' },
  assign: { from: 'confirmed', to: 'assigned' },
  pickup: { from: 'assigned', to: 'picked_up' },
  deliver: { from: 'in_transit', to: 'delivered' },
  fail: { from: 'in_transit', to: 'failed' },
  complete: { from: 'delivered', to: 'completed' },
  retry: { from: 'failed', to: 'confirmed' },
};

/** Actions that can be performed from a given status */
export const AVAILABLE_ACTIONS: Record<string, string[]> = {
  draft: ['confirm', 'cancel'],
  confirmed: ['assign', 'cancel'],
  assigned: ['pickup', 'cancel'],
  picked_up: [],
  in_transit: ['deliver', 'fail'],
  delivered: ['complete'],
  failed: ['retry'],
  completed: [],
  cancelled: [],
};
