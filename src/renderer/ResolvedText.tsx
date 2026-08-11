import { Form } from 'antd';
import { useCallback, useMemo } from 'react';
import { resolveTextTemplate, textDependencies } from './template';
import { useScreenContext } from './screenContext';

/**
 * `{{field}}` text, resolved from whatever payload the screen is running on.
 *
 * A heading or a callout sitting among inputs has to show what the person is
 * typing *now*, which a static payload cannot give it. But watching the whole
 * form to get that would re-render every display node on every keystroke —
 * exactly what `useFieldVisibility` was written to avoid. So the live path
 * watches only the names the template actually mentions.
 *
 * The live and static paths are separate components rather than a branch inside
 * one, because `Form.useWatch` outside a `<Form>` warns and returns nothing, and
 * a hook cannot be skipped. `live` never changes for a given tree, so React
 * never sees the element type flip.
 */

interface TemplateProps {
  template: string;
  /** Shown when the template resolves to nothing — an unanswered field. */
  fallback?: string;
}

function LiveText({ template, fallback = '' }: TemplateProps) {
  const names = useMemo(() => textDependencies(template), [template]);
  // Rebuilt inline every render, so key the selector on its contents — the same
  // reason `useFieldVisibility` keys on `scopePath.join(' ')`.
  const nameKey = names.join(' ');

  const selector = useCallback(
    (values: unknown) => {
      const source = (values ?? {}) as Record<string, unknown>;
      const picked: Record<string, unknown> = {};
      for (const name of names) picked[name] = source[name];
      return picked;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nameKey encodes names
    [nameKey],
  );

  // Returning a fresh object is fine: rc-field-form compares the selection by
  // its serialised form, so this re-renders only when a watched value changes.
  const watched = Form.useWatch(selector) as Record<string, unknown> | undefined;
  return <>{resolveTextTemplate(template, watched ?? {}) || fallback}</>;
}

function StaticText({ template, fallback = '' }: TemplateProps) {
  const { values } = useScreenContext();
  return <>{resolveTextTemplate(template, values) || fallback}</>;
}

export function ResolvedText({ template, fallback }: TemplateProps) {
  const { live } = useScreenContext();
  return live ? (
    <LiveText template={template} fallback={fallback} />
  ) : (
    <StaticText template={template} fallback={fallback} />
  );
}

/**
 * The same resolution where a string is required rather than a node — an
 * `alt` attribute, an `<img src>`, a `Descriptions` label.
 *
 * Static only, and deliberately so: an attribute cannot host a component, and
 * making every one of them a live subscription would reintroduce the re-render
 * storm this module exists to avoid. Callers that need a live *element* use
 * `<ResolvedText>`.
 */
export function useStaticText(template: string): string {
  const { values } = useScreenContext();
  return resolveTextTemplate(template, values);
}
