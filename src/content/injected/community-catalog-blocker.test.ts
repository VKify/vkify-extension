// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';

it('filters only catalog responses while the communities setting is enabled', async () => {
  const url = 'https://web.api.vk.ru/method/catalog.getGroups';
  const subscriptions = { data_type: 'groups_items', url: '/groups/my_all_groups' };
  const recent = { data_type: 'groups_items', url: '/groups/recent_my', layout: { name: 'slider' } };
  const payload = { response: {
    groups: [{ id: 1 }],
    catalog: { default_section: 'side', sections: [{ id: 'side', blocks: [
      { title: 'Популярное', data_type: 'none', layout: { name: 'header_compact' } },
      { title: 'Популярное', data_type: 'groups_items', url: '/groups/side/trends' },
      { title: 'Популярное', data_type: 'action', layout: { name: 'horizontal_buttons' } },
      { data_type: 'none', layout: { name: 'header_compact', title: 'Для вас' } },
      { data_type: 'groups_items', title: 'Для вас', layout: { name: 'slider_minimalistic_card' } },
      { data_type: 'groups_items', title: 'K-pop' },
      { data_type: 'action', title: 'K-pop', layout: { name: 'horizontal_buttons' },
        actions: [{ action: { url: '/groups?act=catalog&c[category]=kpop' } }] },
      subscriptions,
      recent,
    ] }] },
  } };
  const setEnabled = (enabled: boolean) => window.dispatchEvent(new CustomEvent('vkify-update-settings', {
    detail: { block_recommendations_communities: enabled },
  }));
  const native = window.fetch;
  const fetch = vi.fn(async () => new Response(JSON.stringify(payload)));
  window.fetch = fetch;
  try {
    const entry = () => ({ method: 'catalog.getGroups', ...structuredClone(payload) });
    const initial = entry();
    Reflect.set(window, 'cur', { apiPrefetchCache: [initial] });
    await import('./community-catalog-blocker.js');
    expect(window.fetch).toBe(fetch);
    expect(initial.response.catalog.sections[0].blocks).toEqual(payload.response.catalog.sections[0].blocks);
    setEnabled(true);
    expect(initial.response).toEqual(payload.response);
    const header = { id: 'header', data_type: 'none', layout: { name: 'header_large', title: 'Для вас' },
      actions: [{ action: { type: 'open_section', url: 'https://vk.ru/groups/for_you' } }] };
    const slider = { id: 'slider', data_type: 'groups_items', layout: { name: 'slider_minimalistic_card' },
      url: 'https://vk.ru/groups/for_you', group_items: [{ id: 2 }], next_from: 'more-recommendations' };
    const blocks = [recent, subscriptions, header, slider];
    const prefetched = { method: 'catalog.getGroups', response: {
      catalog: { default_section: 'main', sections: [
        { id: 'main', url: 'https://vk.ru/groups', next_from: 'section-cursor', blocks },
        { id: 'other', url: 'https://vk.ru/groups/my_events', next_from: 'event-cursor', blocks: [recent] },
      ] },
    } };
    Reflect.set(window, 'cur', { apiPrefetchCache: [prefetched] });
    expect(prefetched.response.catalog.sections[0]).toMatchObject({ id: 'main' });
    expect(prefetched.response.catalog.sections[0]).not.toHaveProperty('next_from');
    expect(prefetched.response.catalog.sections[1].next_from).toBe('event-cursor');
    expect(blocks).toHaveLength(4);
    expect(blocks.slice(0, 2)).toEqual([recent, subscriptions]);
    expect(blocks[2]).toMatchObject({ id: 'header', layout: { name: 'header_hidden', title: '' }, actions: [] });
    expect(blocks[3]).toMatchObject({
      id: 'slider', data_type: 'none', layout: { name: 'header_hidden', title: '' },
      actions: [], group_items: undefined, next_from: undefined, url: undefined,
    });
    const replacement = entry();
    Reflect.set(window, 'cur', { apiPrefetchCache: [replacement] });
    expect(replacement.response).toEqual(payload.response);
    const filtered = await (await window.fetch(url + '?v=5.289')).json();
    expect(filtered.response.catalog.sections[0].blocks).toEqual([subscriptions, recent]);
    expect(filtered.response.catalog.default_section).toBe('side');
    expect(filtered.response.groups).toEqual(payload.response.groups);
    expect(await (await window.fetch(url + 'Other')).json()).toEqual(payload);
    expect(await (await window.fetch('https://web.api.vk.ru/method/groups.get')).json()).toEqual(payload);
    setEnabled(false);
    expect(window.fetch).toBe(fetch);
    const unfiltered = entry();
    Reflect.set(window, 'cur', { apiPrefetchCache: [unfiltered] });
    expect(unfiltered.response).toEqual(payload.response);
    expect(await (await window.fetch(url)).json()).toEqual(payload);
  } finally {
    window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
    window.fetch = native;
    Reflect.deleteProperty(window, 'cur');
  }
});

it('suppresses similar-community flags in direct, initial and batch responses while preserving membership and other entities', async () => {
  vi.resetModules();
  const native = window.fetch;
  const group = { id: 42, name: 'Group', is_member: 1, members_count: 100, show_suggestions: 'after_subscribe', has_suggestions: true };
  let payload: unknown = { response: { groups: [group], profiles: [{ id: 10 }], next_from: 'cursor' } };
  window.fetch = vi.fn(async () => new Response(JSON.stringify(payload)));
  try {
    await import('./community-catalog-blocker.js');
    const set = (value: boolean) => window.dispatchEvent(new CustomEvent('vkify-update-settings', { detail: { block_recommendations_communities: value } }));
    set(true);
    const result = await (await window.fetch('https://api.vk.ru/method/groups.getById')).json();
    expect(result.response.groups[0]).toEqual({ id: 42, name: 'Group', is_member: 1, members_count: 100, has_suggestions: false });
    expect(result.response.profiles).toEqual([{ id: 10 }]); expect(result.response.next_from).toBe('cursor');
    const entry = { method: 'groups.getById', response: { groups: [{ ...group, show_suggestions: 'always' }] } };
    Reflect.set(window, 'cur', { apiPrefetchCache: [entry] });
    expect(entry.response.groups[0]).not.toHaveProperty('show_suggestions');
    expect(entry.response.groups[0].has_suggestions).toBe(false);
    payload = { responses: [{ id: 'groups', body: { response: { groups: [group] } } }, { id: 'users', body: { response: { groups: [group] } } }] };
    const body = JSON.stringify({ requests: [{ id: 'groups', method: 'groups.getById' }, { id: 'users', method: 'users.get' }] });
    const batch = await (await window.fetch(new Request('https://web.api.vk.ru/method/batch.call', { method: 'POST', body }))).json();
    expect(batch.responses[0].body.response.groups[0]).not.toHaveProperty('show_suggestions');
    expect(batch.responses[1].body.response.groups[0]).toEqual(group);
    set(false);
    payload = { response: [group] };
    expect(await (await window.fetch('https://api.vk.ru/method/groups.getById')).json()).toEqual(payload);
  } finally {
    window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
    window.fetch = native; Reflect.deleteProperty(window, 'cur');
  }
});
