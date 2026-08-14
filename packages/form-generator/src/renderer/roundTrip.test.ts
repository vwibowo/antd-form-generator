import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { screenSchemaSchema } from '../schema/screen';
import type { CustomComponentRegistry } from './custom';
import { hydrateValues } from './hydrate';
import { buildInitialValues } from './initialValues';
import { serializeValues } from './serialize';

/**
 * `serializeValues` and `hydrateValues` have to be each other's inverse.
 *
 * They are the only pair in the package that must agree, and nothing forced
 * them to: `serialize` took a custom-component registry and `hydrate` did not,
 * so a component that reshaped its value on the way out had no way back. That
 * is not a partial loss — a control guarding with `Array.isArray(value)` and
 * serialising to an object reads an object as *no rows*, so a workflow looping
 * back to an answered step showed the field blank.
 *
 * The trip that matters is payload -> form -> payload, because that is what a
 * loop does, and what a host does when it feeds `onSubmit`'s output back in.
 */

const screen = (nodes: unknown[]) => screenSchemaSchema.parse({ nodes });

/** The demo registry's shape, reduced to the part that reshapes a value. */
const registry: CustomComponentRegistry = {
  keyValue: {
    label: 'Key / value pairs',
    component: () => null,
    valueKind: 'array',
    serialize: (rows: { key: string; value: string }[]) =>
      Array.isArray(rows)
        ? Object.fromEntries(rows.filter((row) => row.key).map((row) => [row.key, row.value]))
        : rows,
    deserialize: (value): { key: string; value: string }[] => {
      if (Array.isArray(value)) return value;
      if (!value || typeof value !== 'object') return [];
      return Object.entries(value as Record<string, unknown>).map(([key, entry]) => ({
        key,
        value: String(entry ?? ''),
      }));
    },
  },
};

const customScreen = screen([
  { id: 'c1', type: 'custom', name: 'metadata', props: { component: 'keyValue' } },
]);

describe('custom components survive a round trip', () => {
  it('reads a reshaped payload back into the shape the control holds', () => {
    const live = [
      { key: 'team', value: 'platform' },
      { key: 'tier', value: 'gold' },
    ];

    const payload = serializeValues(customScreen, { metadata: live }, registry);
    expect(payload.metadata).toEqual({ team: 'platform', tier: 'gold' });

    // The step this whole change exists for.
    expect(hydrateValues(customScreen, payload, registry).metadata).toEqual(live);
  });

  it('is what ScreenRenderer seeds a form with', () => {
    // `ScreenRenderer` builds `initialValues` as schema defaults with a hydrated
    // payload laid over them, and that one expression is the only place in the
    // product where a payload re-enters a form. It went a whole commit without
    // the registry — the function was fixed, its tests passed, and the app still
    // showed an empty field — so the composition is pinned here and not just the
    // function underneath it.
    const payload = serializeValues(
      customScreen,
      { metadata: [{ key: 'team', value: 'platform' }] },
      registry,
    );

    const seeded = {
      ...buildInitialValues(customScreen),
      ...hydrateValues(customScreen, payload, registry),
    };

    expect(seeded.metadata).toEqual([{ key: 'team', value: 'platform' }]);
  });

  it('loses the field when the registry is withheld — the old behaviour', () => {
    const payload = serializeValues(
      customScreen,
      { metadata: [{ key: 'team', value: 'platform' }] },
      registry,
    );

    // Without the registry there is no `deserialize` to run, so the object
    // reaches a control that only understands arrays. Pinned so the cost of
    // forgetting to thread the registry through is visible rather than folklore.
    expect(hydrateValues(customScreen, payload).metadata).toEqual({ team: 'platform' });
  });

  it('leaves a component that never reshapes anything alone', () => {
    const plain = screen([
      { id: 'c1', type: 'custom', name: 'colour', props: { component: 'colourPicker' } },
    ]);
    const bare: CustomComponentRegistry = {
      colourPicker: { label: 'Colour', component: () => null },
    };

    const payload = serializeValues(plain, { colour: '#ff0000' }, bare);
    expect(hydrateValues(plain, payload, bare)).toEqual({ colour: '#ff0000' });
  });

  it('reaches a custom field nested in a repeatable row', () => {
    const nested = screen([
      {
        id: 'l1',
        type: 'list',
        name: 'services',
        children: [
          { id: 'c1', type: 'custom', name: 'metadata', props: { component: 'keyValue' } },
        ],
      },
    ]);

    const live = { services: [{ metadata: [{ key: 'region', value: 'eu' }] }] };
    const payload = serializeValues(nested, live, registry);
    expect(payload.services).toEqual([{ metadata: { region: 'eu' } }]);
    expect(hydrateValues(nested, payload, registry)).toEqual(live);
  });

  it('still round-trips dates, which never needed a registry', () => {
    const dated = screen([{ id: 'd1', type: 'date', name: 'starts' }]);
    const payload = serializeValues(dated, { starts: dayjs('2026-03-01T00:00:00.000Z') });

    expect(typeof payload.starts).toBe('string');
    expect(dayjs.isDayjs(hydrateValues(dated, payload).starts)).toBe(true);
  });
});
