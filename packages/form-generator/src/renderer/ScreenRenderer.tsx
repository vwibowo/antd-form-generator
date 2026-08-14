import { Button, Empty, Form, Row, Space, Typography } from 'antd';
import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ScreenSchema } from '../schema/screen';
import { screenCollectsValues, showsSubmitRow } from '../schema/screen';
import type { CustomComponentRegistry } from './custom';
import { CustomComponentsProvider, useCustomComponents } from './custom';
import { hydrateValues } from './hydrate';
import { buildInitialValues, collectPayloadKeys } from './initialValues';
import { ResolvedText } from './ResolvedText';
import { ScreenContextProvider } from './screenContext';
import { ScreenNodeView } from './ScreenNodeView';
import { serializeValues } from './serialize';

/**
 * Renders a `ScreenSchema` — a form, a page, or the mixture of the two that
 * used to need one of each.
 *
 * The `<Form>` is emitted only when something on the screen actually collects a
 * value. A screen that only tells the reader things has no use for form state,
 * and wrapping it in an inert `<Form>` would make every display node subscribe
 * to a store with nothing in it.
 *
 * This module and everything it imports are deliberately free of builder
 * imports, so `src/renderer/` can be lifted into a standalone package.
 */
export interface ScreenRendererProps {
  schema: ScreenSchema;
  onSubmit?: (values: Record<string, unknown>) => void;
  /**
   * Values to open with, layered over the schema's own defaults, and what a
   * display node reads for `{{token}}` when the screen collects nothing.
   *
   * A workflow that loops back to a step it already visited passes what was
   * answered last time; without it the screen would come back blank and look
   * broken. Given in payload shape — the shape `onSubmit` produces.
   */
  values?: Record<string, unknown>;
  /**
   * A button was pressed: its id, plus whatever the screen had collected.
   *
   * Both arrive together because a screen that asks *and* tells contributes
   * both to the run in one step — that is the whole point of the merge. On a
   * screen that only tells, the values are simply empty.
   *
   * Not called until validation passes, so a required field cannot be walked
   * past by pressing a button instead of Submit.
   */
  onAction?: (actionId: string, values: Record<string, unknown>) => void;
  /** Earlier screens by id, so a `summary` node can lay a payload out. */
  formSources?: Record<string, ScreenSchema>;
  /** Hide the submit row when the host supplies its own actions. */
  showActions?: boolean;
  /**
   * Host-supplied controls for `custom` nodes, keyed by the name a schema puts
   * in `props.component`. Omit to inherit whatever a surrounding
   * `CustomComponentsProvider` supplies.
   */
  components?: CustomComponentRegistry;
}

const NO_VALUES: Record<string, unknown> = {};

/** Title and description, which take `{{token}}` like any other screen text. */
function ScreenHeader({ schema }: { schema: ScreenSchema }) {
  return (
    <>
      {schema.title ? (
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          <ResolvedText template={schema.title} />
        </Typography.Title>
      ) : null}
      {schema.description ? (
        <Typography.Paragraph type="secondary">
          <ResolvedText template={schema.description} />
        </Typography.Paragraph>
      ) : null}
    </>
  );
}

function ScreenNodes({
  schema,
  onAction,
  formSources,
}: {
  schema: ScreenSchema;
  onAction?: (actionId: string) => void;
  formSources?: Record<string, ScreenSchema>;
}) {
  return (
    <Row gutter={[schema.gutter, schema.gutter]}>
      {schema.nodes.map((node) => (
        <ScreenNodeView
          key={node.id}
          node={node}
          scopePath={[]}
          namePrefix={[]}
          gutter={schema.gutter}
          onAction={onAction}
          formSources={formSources}
        />
      ))}
    </Row>
  );
}

/** The interactive half: everything that needs `rc-field-form` behind it. */
function CollectingScreen({
  schema,
  onSubmit,
  values,
  onAction,
  formSources,
  showActions,
  customComponents,
}: ScreenRendererProps & { customComponents: CustomComponentRegistry; showActions: boolean }) {
  const [form] = Form.useForm();

  // No form-wide `useWatch` here on purpose: it would re-render every node on
  // every keystroke. Each node subscribes to its own visibility instead —
  // see `useFieldVisibility` and `ResolvedText`.
  const initialValues = useMemo(() => {
    const seeded = buildInitialValues(schema);
    if (!values) return seeded;
    // Supplied values win: they are an answer, and a default is only a guess at
    // one. Keys the schema no longer has are dropped by the effect below.
    //
    // The registry matters here and nowhere else in this file: this is the only
    // place a payload re-enters a form, so a custom component that reshaped its
    // value on the way out gets its `deserialize` run on the way back in.
    return { ...seeded, ...hydrateValues(schema, values, customComponents) };
  }, [schema, values, customComponents]);
  const payloadKeys = useMemo(() => collectPayloadKeys(schema), [schema]);

  // The builder mutates the schema live, so re-seed on every change: new
  // defaults appear, already-typed values survive, and anything whose node no
  // longer exists is dropped — otherwise loading a different screen (Sample,
  // Import, a JSON edit) would leave the previous one's values behind.
  useEffect(() => {
    const current = form.getFieldsValue(true) as Record<string, unknown>;
    const stale = Object.keys(current).filter((key) => !payloadKeys.has(key));
    if (stale.length > 0) {
      form.resetFields(stale);
      for (const key of stale) delete current[key];
    }
    form.setFieldsValue({ ...initialValues, ...current });
  }, [form, initialValues, payloadKeys]);

  /**
   * A button press carries the values typed so far as well as its own id, so a
   * branch can test either. This is what makes an `actions` node and the submit
   * row one mechanism rather than two.
   *
   * Validation runs first: a screen with both a required field and a button
   * would otherwise let the button skip the rule the submit row enforces. A
   * rejection is left to antd, which has already marked the offending fields.
   */
  const pressAction = (actionId: string) => {
    if (!onAction) return;
    form
      .validateFields()
      .then((collected) =>
        onAction(actionId, serializeValues(schema, collected as Record<string, unknown>, customComponents)),
      )
      .catch(() => undefined);
  };

  return (
    <Form
      form={form}
      layout={schema.layout}
      size={schema.size}
      colon={schema.colon}
      labelCol={schema.layout === 'horizontal' ? schema.labelCol : undefined}
      wrapperCol={schema.layout === 'horizontal' ? schema.wrapperCol : undefined}
      initialValues={initialValues}
      // Dates leave the form as dayjs objects and custom components hold
      // whatever they like; `serializeValues` converts both on the way out.
      onFinish={(submitted) =>
        onSubmit?.(serializeValues(schema, submitted as Record<string, unknown>, customComponents))
      }
      requiredMark
    >
      {/* Inside a form, values are live — display nodes watch rather than read
          a finished payload. See `screenContext.tsx`. */}
      <ScreenContextProvider live>
        <ScreenHeader schema={schema} />
        <ScreenNodes
          schema={schema}
          onAction={onAction ? pressAction : undefined}
          formSources={formSources}
        />

        {showActions && showsSubmitRow(schema) ? (
          <Form.Item style={{ marginTop: 8 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {schema.submitText}
              </Button>
              {schema.showReset ? (
                <Button
                  htmlType="button"
                  onClick={() => {
                    form.resetFields();
                  }}
                >
                  Reset
                </Button>
              ) : null}
            </Space>
          </Form.Item>
        ) : null}
      </ScreenContextProvider>
    </Form>
  );
}

/** The read-only half: no form state exists, so nothing subscribes to any. */
function TellingScreen({
  schema,
  values,
  onAction,
  formSources,
}: {
  schema: ScreenSchema;
  values: Record<string, unknown>;
  onAction?: (actionId: string, values: Record<string, unknown>) => void;
  formSources?: Record<string, ScreenSchema>;
}) {
  return (
    <ScreenContextProvider live={false} values={values}>
      <ScreenHeader schema={schema} />
      <ScreenNodes
        schema={schema}
        // Nothing was collected here, so the button carries only its own id.
        onAction={onAction ? (actionId) => onAction(actionId, {}) : undefined}
        formSources={formSources}
      />
    </ScreenContextProvider>
  );
}

export function ScreenRenderer({
  schema,
  onSubmit,
  values,
  onAction,
  formSources,
  showActions = true,
  components,
}: ScreenRendererProps) {
  const inherited = useCustomComponents();
  const customComponents = components ?? inherited;
  const collects = screenCollectsValues(schema);

  if (schema.nodes.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="This screen is empty"
        style={{ padding: '48px 0' }}
      />
    );
  }

  const body: ReactNode = collects ? (
    <CollectingScreen
      schema={schema}
      onSubmit={onSubmit}
      values={values}
      onAction={onAction}
      formSources={formSources}
      showActions={showActions}
      customComponents={customComponents}
    />
  ) : (
    <TellingScreen
      schema={schema}
      values={values ?? NO_VALUES}
      onAction={onAction}
      formSources={formSources}
    />
  );

  return (
    // Re-provided so the `components` prop reaches the nodes even when the
    // host did not wrap this subtree itself.
    <CustomComponentsProvider components={customComponents}>
      {schema.maxWidth ? (
        <div className="fg-page" style={{ maxWidth: schema.maxWidth, margin: '0 auto' }}>
          {body}
        </div>
      ) : (
        body
      )}
    </CustomComponentsProvider>
  );
}
