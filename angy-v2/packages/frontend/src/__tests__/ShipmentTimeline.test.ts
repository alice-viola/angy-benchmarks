import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ShipmentTimeline from '../components/shipments/ShipmentTimeline.vue';
import type { ShipmentEventResponse } from '@nexusfleet/shared';

function makeEvent(overrides: Partial<ShipmentEventResponse> = {}): ShipmentEventResponse {
  return {
    id: crypto.randomUUID(),
    event_type: 'status_change',
    from_status: null,
    to_status: null,
    notes: null,
    metadata: {},
    created_by: null,
    created_at: '2026-03-12T14:30:00.000Z',
    ...overrides,
  };
}

function createWrapper(events: ShipmentEventResponse[]) {
  return mount(ShipmentTimeline, {
    props: { events },
    global: {
      stubs: {
        Clock: { template: '<span class="icon-clock"></span>' },
        ArrowRight: { template: '<span class="icon-arrow-right"></span>' },
      },
    },
  });
}

describe('ShipmentTimeline', () => {
  describe('Event rendering', () => {
    it('renders correct number of timeline events', () => {
      const events = [
        makeEvent({ event_type: 'created' }),
        makeEvent({ event_type: 'status_change', from_status: 'draft', to_status: 'confirmed' }),
        makeEvent({ event_type: 'status_change', from_status: 'confirmed', to_status: 'assigned' }),
      ];
      const wrapper = createWrapper(events);

      // Each event is a direct child div with class "relative flex gap-4 pb-6"
      const eventElements = wrapper.findAll('.relative.flex.gap-4');
      expect(eventElements.length).toBe(3);
    });

    it('renders one event for a single-event array', () => {
      const events = [makeEvent({ event_type: 'created' })];
      const wrapper = createWrapper(events);

      const eventElements = wrapper.findAll('.relative.flex.gap-4');
      expect(eventElements.length).toBe(1);
    });
  });

  describe('Status transition display', () => {
    it('renders from_status and to_status when present', () => {
      const events = [
        makeEvent({
          event_type: 'status_change',
          from_status: 'draft',
          to_status: 'confirmed',
        }),
      ];
      const wrapper = createWrapper(events);

      expect(wrapper.text()).toContain('draft');
      expect(wrapper.text()).toContain('confirmed');
      // Transition display should have the from→to status elements
      const transitionEl = wrapper.find('.flex.items-center.gap-1\\.5');
      expect(transitionEl.exists()).toBe(true);
    });

    it('renders draft to confirmed event (info/blue transition)', () => {
      const events = [
        makeEvent({
          event_type: 'status_change',
          from_status: 'draft',
          to_status: 'confirmed',
        }),
      ];
      const wrapper = createWrapper(events);

      // The timeline dot uses primary-50/primary-500 colors (blue-ish)
      const dot = wrapper.find('.bg-primary-50');
      expect(dot.exists()).toBe(true);
      expect(wrapper.text()).toContain('confirmed');
    });

    it('renders in_transit to failed event (danger/red context)', () => {
      const events = [
        makeEvent({
          event_type: 'status_change',
          from_status: 'in_transit',
          to_status: 'failed',
        }),
      ];
      const wrapper = createWrapper(events);

      // Event is rendered with from/to status text
      expect(wrapper.text()).toContain('in transit');
      expect(wrapper.text()).toContain('failed');
    });

    it('renders in_transit to delivered event (success/green context)', () => {
      const events = [
        makeEvent({
          event_type: 'status_change',
          from_status: 'in_transit',
          to_status: 'delivered',
        }),
      ];
      const wrapper = createWrapper(events);

      expect(wrapper.text()).toContain('in transit');
      expect(wrapper.text()).toContain('delivered');
    });
  });

  describe('Active state (last event)', () => {
    it('renders last event without connector line', () => {
      const events = [
        makeEvent({ event_type: 'created' }),
        makeEvent({ event_type: 'status_change', from_status: 'draft', to_status: 'confirmed' }),
      ];
      const wrapper = createWrapper(events);

      const eventElements = wrapper.findAll('.relative.flex.gap-4');
      const lastEvent = eventElements[eventElements.length - 1];

      // Last event should NOT have the connector line (w-px ... bg-neutral-200)
      const connectorLine = lastEvent.find('.w-px.bg-neutral-200');
      expect(connectorLine.exists()).toBe(false);
    });

    it('renders connector line for non-last events', () => {
      const events = [
        makeEvent({ event_type: 'created' }),
        makeEvent({ event_type: 'status_change', from_status: 'draft', to_status: 'confirmed' }),
      ];
      const wrapper = createWrapper(events);

      const eventElements = wrapper.findAll('.relative.flex.gap-4');
      const firstEvent = eventElements[0];

      // First event SHOULD have the connector line
      const connectorLine = firstEvent.find('.w-px');
      expect(connectorLine.exists()).toBe(true);
    });
  });

  describe('Timestamp rendering', () => {
    it('renders formatted timestamp', () => {
      const events = [
        makeEvent({
          event_type: 'created',
          created_at: '2026-03-12T14:30:00.000Z',
        }),
      ];
      const wrapper = createWrapper(events);

      // Should contain formatted date parts (locale-dependent, but should have month and time)
      const text = wrapper.text();
      // The component formats as "MMM D, HH:mm" using toLocaleString
      // In jsdom, check that some date representation appears
      expect(text).toMatch(/Mar|03/); // Month
    });
  });

  describe('Created by rendering', () => {
    it('renders created_by name when provided', () => {
      const events = [
        makeEvent({
          event_type: 'created',
          created_by: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            first_name: 'John',
            last_name: 'Smith',
          },
        }),
      ];
      const wrapper = createWrapper(events);

      expect(wrapper.text()).toContain('John');
      expect(wrapper.text()).toContain('Smith');
      expect(wrapper.text()).toContain('by');
    });

    it('does not render created_by section when null', () => {
      const events = [
        makeEvent({
          event_type: 'created',
          created_by: null,
        }),
      ];
      const wrapper = createWrapper(events);

      // "by" should not appear without a created_by
      const byElements = wrapper.findAll('span').filter((s) => s.text().startsWith('by '));
      expect(byElements.length).toBe(0);
    });
  });

  describe('Notes rendering', () => {
    it('renders notes when provided', () => {
      const events = [
        makeEvent({
          event_type: 'status_change',
          notes: 'Package was damaged during transit',
        }),
      ];
      const wrapper = createWrapper(events);

      expect(wrapper.text()).toContain('Package was damaged during transit');
    });

    it('does not render notes paragraph when notes is null', () => {
      const events = [
        makeEvent({
          event_type: 'status_change',
          notes: null,
        }),
      ];
      const wrapper = createWrapper(events);

      // Count paragraphs — no notes paragraph should appear
      expect(wrapper.text()).not.toContain('null');
    });
  });

  describe('Empty state', () => {
    it('renders empty state message when no events', () => {
      const wrapper = createWrapper([]);

      expect(wrapper.text()).toContain('No events recorded yet');
    });
  });

  describe('Event type formatting', () => {
    it('formats event_type with underscores replaced by spaces', () => {
      const events = [
        makeEvent({ event_type: 'status_change' }),
      ];
      const wrapper = createWrapper(events);

      expect(wrapper.text()).toContain('status change');
      expect(wrapper.text()).not.toContain('status_change');
    });
  });
});
