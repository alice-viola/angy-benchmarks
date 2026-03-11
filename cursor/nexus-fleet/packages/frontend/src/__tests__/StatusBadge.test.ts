import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusBadge from '@/components/common/StatusBadge.vue';

describe('StatusBadge', () => {
  const colorExpectations: {
    status: string;
    bg: string;
    text: string;
    dot: string;
    label: string;
  }[] = [
    { status: 'draft', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', label: 'Draft' },
    { status: 'confirmed', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Confirmed' },
    { status: 'assigned', bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Assigned' },
    { status: 'picked_up', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Picked Up' },
    { status: 'in_transit', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'In Transit' },
    { status: 'delivered', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Delivered' },
    { status: 'completed', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Completed' },
    { status: 'failed', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Failed' },
    { status: 'cancelled', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-500', label: 'Cancelled' },
    { status: 'available', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Available' },
    { status: 'driving', bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Driving' },
    { status: 'maintenance', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Maintenance' },
  ];

  describe('renders correct text for each status', () => {
    it.each(colorExpectations)(
      'displays "$label" for status "$status"',
      ({ status, label }) => {
        const wrapper = mount(StatusBadge, { props: { status } });
        expect(wrapper.text()).toBe(label);
      },
    );
  });

  describe('applies correct CSS classes', () => {
    it.each(colorExpectations)(
      'has correct bg/text classes for "$status"',
      ({ status, bg, text }) => {
        const wrapper = mount(StatusBadge, { props: { status } });
        const badge = wrapper.find('.badge');

        expect(badge.classes()).toContain(bg);
        expect(badge.classes()).toContain(text);
      },
    );
  });

  describe('dot indicator', () => {
    it.each(colorExpectations)(
      'displays dot with correct color for "$status"',
      ({ status, dot }) => {
        const wrapper = mount(StatusBadge, { props: { status } });
        const dotEl = wrapper.find('.rounded-full.h-1\\.5');

        expect(dotEl.exists()).toBe(true);
        expect(dotEl.classes()).toContain(dot);
      },
    );

    it('dot is always present', () => {
      const wrapper = mount(StatusBadge, { props: { status: 'draft' } });
      const dots = wrapper.findAll('.h-1\\.5.w-1\\.5');
      expect(dots).toHaveLength(1);
    });
  });

  describe('label formatting', () => {
    it('converts underscored status to title case', () => {
      const wrapper = mount(StatusBadge, { props: { status: 'picked_up' } });
      expect(wrapper.text()).toBe('Picked Up');
    });

    it('capitalizes single-word status', () => {
      const wrapper = mount(StatusBadge, { props: { status: 'draft' } });
      expect(wrapper.text()).toBe('Draft');
    });

    it('handles multi-underscore status', () => {
      const wrapper = mount(StatusBadge, { props: { status: 'in_transit' } });
      expect(wrapper.text()).toBe('In Transit');
    });
  });

  describe('fallback for unknown statuses', () => {
    it('uses fallback colors for unknown status', () => {
      const wrapper = mount(StatusBadge, { props: { status: 'unknown_status' } });
      const badge = wrapper.find('.badge');

      expect(badge.classes()).toContain('bg-slate-100');
      expect(badge.classes()).toContain('text-slate-600');
    });

    it('still displays formatted text for unknown status', () => {
      const wrapper = mount(StatusBadge, { props: { status: 'something_new' } });
      expect(wrapper.text()).toBe('Something New');
    });
  });
});
