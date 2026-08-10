import type { ConditionGroup, ConditionOperator } from '@/schema/schema';
import { UNARY_OPERATORS } from '@/schema/schema';

/**
 * Human wording for a branch condition, used on the canvas chip and in the run
 * trace. Deliberately terse — the chip has about thirty characters before it
 * starts covering the graph.
 */

const OPERATOR_TEXT: Record<ConditionOperator, string> = {
  eq: 'is',
  neq: 'is not',
  in: 'is one of',
  notIn: 'is not one of',
  gt: '>',
  lt: '<',
  contains: 'contains',
  empty: 'is empty',
  notEmpty: 'is set',
};

export function summarizeCondition(group: ConditionGroup | undefined): string {
  if (!group || group.conditions.length === 0) return '';

  const parts = group.conditions.map((condition) => {
    const operator = OPERATOR_TEXT[condition.operator];
    if (UNARY_OPERATORS.includes(condition.operator)) {
      return `${condition.field} ${operator}`;
    }
    return `${condition.field} ${operator} ${String(condition.value ?? '')}`.trim();
  });

  return parts.join(group.logic === 'and' ? ' and ' : ' or ');
}

/** What the canvas prints on a branch: its label, its condition, or nothing. */
export function edgeCaption(
  label: string,
  condition: ConditionGroup | undefined,
  isDefault: boolean,
): string {
  if (label) return label;
  if (isDefault) return 'Otherwise';
  return summarizeCondition(condition);
}
