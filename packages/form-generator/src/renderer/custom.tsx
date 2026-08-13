import { Typography } from 'antd';
import { createContext, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { PropSpec } from '../schema/propSpecs';
import type { ScreenNode, SelectOption } from '../schema/screen';

/**
 * Host-supplied controls.
 *
 * A schema can only ever name a component (`props.component`); the component
 * itself comes from the app embedding the renderer. That split is deliberate:
 * an imported `.json` must never be able to introduce code, so nothing here is
 * built from a string in the schema.
 */

/** Props a custom control receives. `value`/`onChange` are injected by `Form.Item`. */
export interface CustomFieldProps<V = unknown> {
  value?: V;
  onChange?: (value: V) => void;
  disabled?: boolean;
  placeholder?: string;
  /** The whole node, so a component can read its own keys out of `props`. */
  node: ScreenNode;
  /** Static or remote options, when the field was configured with any. */
  options?: SelectOption[];
}

export interface CustomComponentDef<V = any> {
  /** Shown in the palette and the inspector's component picker. */
  label: string;
  component: ComponentType<CustomFieldProps<V>>;
  /** Palette icon. Falls back to a generic one. */
  icon?: ReactNode;
  /**
   * Inspector rows for this component's own `props` keys — the same shape the
   * built-in types use, so they render through the identical editor.
   */
  propSpecs?: PropSpec[];
  /** Seeded onto a freshly dropped node. `props` merges over the type defaults. */
  defaults?: { label?: string; namePrefix?: string; props?: Record<string, unknown> };
  /** For controls whose value lives elsewhere, e.g. `checked`. */
  valuePropName?: string;
  /** Drives how `min`/`max` rules are interpreted. Defaults to `string`. */
  valueKind?: 'string' | 'number' | 'array';
  /** Convert the live value into something JSON-serialisable at submit time. */
  serialize?: (value: V, node: ScreenNode) => unknown;
  /**
   * Read `serialize`'s output back into a value the control can hold — the
   * inverse, run whenever a payload re-enters a form.
   *
   * Only needed when `serialize` changes the *shape*. A component that stores a
   * string and submits a string needs nothing here, which is why this is
   * optional and why the value passes through untouched without it.
   *
   * When it is needed, its absence is silent and total rather than partial: a
   * control that guards with `Array.isArray(value) ? value : []` and serialises
   * to an object gets an empty array back, and the row a reader typed simply is
   * not there when a workflow loops to that step again.
   */
  deserialize?: (value: unknown, node: ScreenNode) => V;
  /**
   * How this component's value reads on a summary page. Receives the value as
   * it sits in the payload, so a serialised shape is what arrives. Omit it and
   * the summary prints `serialize`'s output instead.
   */
  summary?: (value: V, node: ScreenNode) => ReactNode;
}

export type CustomComponentRegistry = Record<string, CustomComponentDef>;

const CustomComponentsContext = createContext<CustomComponentRegistry>({});

export function CustomComponentsProvider({
  components,
  children,
}: {
  components: CustomComponentRegistry;
  children: ReactNode;
}) {
  return (
    <CustomComponentsContext.Provider value={components}>
      {children}
    </CustomComponentsContext.Provider>
  );
}

export function useCustomComponents(): CustomComponentRegistry {
  return useContext(CustomComponentsContext);
}

/** The component key a node asks for, if any. */
export function customKeyOf(node: ScreenNode): string | undefined {
  const key = node.props?.component;
  return typeof key === 'string' && key !== '' ? key : undefined;
}

export function customDefFor(
  node: ScreenNode,
  registry: CustomComponentRegistry | undefined,
): CustomComponentDef | undefined {
  const key = customKeyOf(node);
  return key ? registry?.[key] : undefined;
}

/**
 * Shown when a schema names a component this app does not register — an
 * exported form opened in a different host, or a key typed by hand. Renders
 * instead of throwing, so one unknown field cannot take down the form.
 */
export function MissingCustomComponent({ componentKey }: { componentKey?: string }) {
  return (
    <div
      style={{
        border: '1px dashed rgba(5, 5, 5, 0.25)',
        borderRadius: 8,
        padding: '10px 12px',
        background: 'rgba(5, 5, 5, 0.02)',
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {componentKey
          ? `Component "${componentKey}" is not registered in this app.`
          : 'No component chosen for this field yet.'}
      </Typography.Text>
    </div>
  );
}
