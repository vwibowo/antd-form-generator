/**
 * The public surface: what a host app needs to render a document, and nothing
 * about how one is authored.
 *
 * Every file in this package is still reachable by subpath — the builder next
 * door imports two dozen of them — but reachable is not the same as supported.
 * What is re-exported here is what a host may rely on; a subpath import is a
 * host reaching past the contract, which it may do, knowing that.
 *
 * The line drawn is *render* versus *edit*. The node registry, the prop specs,
 * the factories and the walkers all exist to build a document in a UI, and a
 * host embedding a renderer has no use for them.
 */

/* ── Renderers ────────────────────────────────────────────────────────────── */

export { ScreenRenderer } from './renderer/ScreenRenderer';
export type { ScreenRendererProps } from './renderer/ScreenRenderer';
export { TableRenderer } from './renderer/table/TableRenderer';
export type { TableRendererProps } from './renderer/table/TableRenderer';
export type { TableRow } from './renderer/table/columns';
export { SummaryRenderer } from './renderer/summary/SummaryRenderer';
export type { SummaryRendererProps } from './renderer/summary/SummaryRenderer';

/* ── Host configuration ───────────────────────────────────────────────────── */

export { RendererConfigProvider, useRendererConfig } from './renderer/config/RendererConfigProvider';
export type {
  RendererConfigProviderProps,
  ResolvedRendererConfig,
} from './renderer/config/RendererConfigProvider';
export type {
  RendererConfig,
  RendererFetcher,
  RendererLocale,
  RendererRequest,
  RendererRequestKind,
  ResolvedRendererRequest,
} from './renderer/config/types';
export { DEFAULT_LOCALE } from './renderer/config/types';
export type { RendererError, RendererErrorCode } from './renderer/config/errors';
export { createResponseCache } from './renderer/config/cache';
export type { ResponseCache } from './renderer/config/cache';
// Exported so a host can unit-test its own allowlist rather than discover in
// production that `evil-example.com` matched `example.com`.
export { decideRequest, isAllowed } from './renderer/config/policy';
export type { RequestDecision, RequestPolicy, RequestRefusalCode } from './renderer/config/policy';

/* ── Host-supplied controls ───────────────────────────────────────────────── */

export {
  CustomComponentsProvider,
  MissingCustomComponent,
  useCustomComponents,
} from './renderer/custom';
export type {
  CustomComponentDef,
  CustomComponentRegistry,
  CustomFieldProps,
} from './renderer/custom';

/* ── Reading a document from outside ──────────────────────────────────────── */

export { parseDocument } from './schema/document';
export type { DocumentKind, DocumentParseResult } from './schema/document';
export { isValid, validateDocument } from './schema/validate';
export type { Diagnostic, ValidationResult } from './schema/validate';

export {
  collectScreenActions,
  collectsValue,
  parseScreenSchema,
  screenCollectsValues,
  showsSubmitRow,
} from './schema/screen';
export type {
  DataSource,
  ScreenAction,
  ScreenNode,
  ScreenNodeType,
  ScreenSchema,
  SelectOption,
} from './schema/screen';
export { parseTableSchema } from './schema/table';
export type {
  CellFormat,
  TableAction,
  TableColumn,
  TableSchema,
  TableSelection,
  TableSource,
} from './schema/table';
export { parseWorkflowSchema } from './schema/workflow';
export type {
  ApprovalOutcome,
  NodeAction,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowSchema,
} from './schema/workflow';
export type { Condition, ConditionGroup, ConditionOperator } from './schema/nodeBase';

/* ── Payload shape, both directions ───────────────────────────────────────── */

export { serializeValues } from './renderer/serialize';
export { hydrateValues } from './renderer/hydrate';
export { buildInitialValues, collectPayloadKeys } from './renderer/initialValues';
export { evaluateCondition } from './renderer/condition';

/* ── The run engine, usable without any component ─────────────────────────── */

export {
  advanceWorkflow,
  chooseEdge,
  describeBlock,
  startWorkflow,
} from './renderer/workflow/engine';
export type {
  WorkflowBlockReason,
  WorkflowRunState,
  WorkflowRunStatus,
} from './renderer/workflow/engine';
export { findWorkflowNode, validateWorkflow, workflowStages } from './schema/workflowGraph';
export type { WorkflowIssue, WorkflowStage } from './schema/workflowGraph';
