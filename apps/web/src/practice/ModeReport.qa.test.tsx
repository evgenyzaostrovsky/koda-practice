import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { RunResult } from '../types';
import { ModeReport } from './ModeReport';

const result = { ok: true, execution_ms: 1, result: { kind: 'scalar', data: {
  cards: { revenue: 385000, orders: 30 },
  visuals: { city: [{ city: 'Волгоград', value: 169000 }, { city: 'Москва', value: 145100 }] },
  full_visuals: { city: [{ city: 'Волгоград', value: 169000 }, { city: 'Москва', value: 145100 }] },
  visual_options: { channel: ['Сайт', 'Приложение'] },
} } } as RunResult;
afterEach(cleanup);

it('supports chart click, second click clearing and keyboard-accessible selection state', () => {
  const callback = vi.fn();
  const initial = { slicers: [], filters: {}, selection: null, interaction_events: [] };
  const view = render(<ModeReport result={result} code={JSON.stringify(initial)} onPreview={callback} />);
  const button = screen.getByRole('button', { name: 'Волгоград' });
  expect(button).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(button);
  const selected = JSON.parse(callback.mock.calls[0][0]);
  expect(selected.selection).toEqual({ field: 'city', value: 'Волгоград' });
  view.rerender(<ModeReport result={result} code={JSON.stringify(selected)} onPreview={callback} />);
  expect(screen.getByRole('button', { name: 'Волгоград' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Волгоград' }));
  expect(JSON.parse(callback.mock.calls[1][0]).selection).toEqual({ field: 'city', value: null });
  expect(JSON.parse(callback.mock.calls[1][0]).interaction_events).toHaveLength(2);
});

it('supports multiselect filters and clearing without deleting authored report settings', () => {
  const callback = vi.fn();
  const initial = { operation: 'report', slicers: ['channel'], filters: { channel: ['Сайт'] }, selection: { field: 'city', value: 'Москва' }, measures: { revenue: 'SUM(orders[revenue])' }, interaction_events: [] };
  render(<ModeReport result={result} code={JSON.stringify(initial)} onPreview={callback} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Приложение' }));
  expect(JSON.parse(callback.mock.calls[0][0]).filters.channel).toEqual(['Сайт', 'Приложение']);
  fireEvent.click(screen.getByRole('button', { name: 'Очистить фильтры и выбор' }));
  const cleared = JSON.parse(callback.mock.calls[1][0]);
  expect(cleared.filters).toEqual({});
  expect(cleared.selection).toBeNull();
  expect(cleared.measures).toEqual(initial.measures);
});
