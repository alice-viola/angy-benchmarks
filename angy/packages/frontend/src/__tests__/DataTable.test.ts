import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import DataTable from '@/components/common/DataTable.vue';

const columns = [
  { key: 'name', label: 'Name', sortable: true, filterable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'age', label: 'Age' },
];

const sampleData = [
  { name: 'Alice', status: 'active', age: 30 },
  { name: 'Bob', status: 'inactive', age: 25 },
  { name: 'Charlie', status: 'active', age: 35 },
];

function mountTable(overrides: Record<string, any> = {}) {
  return mount(DataTable, {
    props: {
      columns,
      data: sampleData,
      loading: false,
      totalItems: sampleData.length,
      page: 1,
      pageSize: 10,
      ...overrides,
    },
    global: {
      stubs: {
        Pagination: true,
      },
    },
  });
}

describe('DataTable', () => {
  it('renders correct number of rows from data prop', () => {
    const wrapper = mountTable();
    // Desktop table rows
    const rows = wrapper.findAll('table tbody tr');
    expect(rows.length).toBe(sampleData.length);
  });

  it('click column header once → emits update:sort with asc', async () => {
    const wrapper = mountTable();
    const headers = wrapper.findAll('thead tr:first-child th');
    // First th is checkbox, second is "Name" (sortable)
    await headers[1].trigger('click');

    const events = wrapper.emitted('update:sort');
    expect(events).toBeDefined();
    expect(events![0][0]).toEqual({ field: 'name', direction: 'asc' });
  });

  it('click same header again → emits desc', async () => {
    const wrapper = mountTable();
    const header = wrapper.findAll('thead tr:first-child th')[1];

    await header.trigger('click'); // asc
    await header.trigger('click'); // desc

    const events = wrapper.emitted('update:sort')!;
    expect(events[1][0]).toEqual({ field: 'name', direction: 'desc' });
  });

  it('click header third time → emits direction null', async () => {
    const wrapper = mountTable();
    const header = wrapper.findAll('thead tr:first-child th')[1];

    await header.trigger('click'); // asc
    await header.trigger('click'); // desc
    await header.trigger('click'); // null

    const events = wrapper.emitted('update:sort')!;
    expect(events[2][0]).toEqual({ field: 'name', direction: null });
  });

  it('type in ColumnFilter → emits update:filters after 300ms debounce', async () => {
    vi.useFakeTimers();
    const wrapper = mountTable();

    // Find ColumnFilter input (in filter row)
    const filterInput = wrapper.find('input[type="text"]');
    expect(filterInput.exists()).toBe(true);

    await filterInput.setValue('test');
    await nextTick();

    // Before debounce
    expect(wrapper.emitted('update:filters')).toBeUndefined();

    // After 300ms
    vi.advanceTimersByTime(300);
    await nextTick();

    const events = wrapper.emitted('update:filters');
    expect(events).toBeDefined();
    expect(events![0][0]).toEqual({ name: 'test' });

    vi.useRealTimers();
  });

  it('loading=true → shows skeleton rows instead of data rows', () => {
    const wrapper = mountTable({ loading: true });
    const skeletonDivs = wrapper.findAll('.animate-pulse');
    expect(skeletonDivs.length).toBeGreaterThan(0);

    // No data rows rendered
    const dataRows = wrapper.findAll('table tbody tr td.text-slate-700');
    // Skeleton rows contain LoadingSkeleton cells, not data cells
    const textContent = wrapper.find('table tbody').text();
    expect(textContent).not.toContain('Alice');
  });

  it('data=[] → shows empty state slot content', () => {
    const wrapper = mountTable({ data: [], totalItems: 0 });
    expect(wrapper.text()).toContain('No data available.');
  });

  it('viewport <768px → renders card layout (CSS class check)', () => {
    const wrapper = mountTable();
    // Mobile layout container exists with md:hidden class
    const mobileContainer = wrapper.find('.md\\:hidden');
    expect(mobileContainer.exists()).toBe(true);

    // Desktop table has hidden md:block
    const desktopContainer = wrapper.find('.hidden.md\\:block');
    expect(desktopContainer.exists()).toBe(true);
  });
});
