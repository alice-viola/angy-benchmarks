export const SHIPMENT_STATES = [
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

export type ShipmentState = (typeof SHIPMENT_STATES)[number];

export const SHIPMENT_ACTIONS = [
  'confirm',
  'assign',
  'pickup',
  'deliver',
  'fail',
  'complete',
  'cancel',
] as const;

export type ShipmentAction = (typeof SHIPMENT_ACTIONS)[number];

export const SHIPMENT_TRANSITIONS: Record<ShipmentState, ShipmentAction[]> = {
  draft: ['confirm', 'cancel'],
  confirmed: ['assign', 'cancel'],
  assigned: ['pickup', 'cancel'],
  picked_up: ['deliver', 'fail'],
  in_transit: ['deliver', 'fail'],
  delivered: ['complete'],
  completed: [],
  failed: ['confirm'],
  cancelled: [],
};

export const SHIPMENT_ACTION_TARGET: Record<ShipmentAction, ShipmentState> = {
  confirm: 'confirmed',
  assign: 'assigned',
  pickup: 'picked_up',
  deliver: 'delivered',
  fail: 'failed',
  complete: 'completed',
  cancel: 'cancelled',
};
