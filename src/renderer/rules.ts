import type { FormItemProps } from 'antd';
import type { FieldType, RuleSpec } from '@/schema/schema';

export type AntdRule = NonNullable<FormItemProps['rules']>[number];

/** antd applies min/max/len differently per value kind. */
function valueKind(fieldType: FieldType): 'number' | 'array' | 'string' {
  switch (fieldType) {
    case 'number':
    case 'slider':
    case 'rate':
      return 'number';
    case 'checkboxGroup':
    case 'upload':
      return 'array';
    default:
      return 'string';
  }
}

function withMessage<T extends object>(rule: T, message?: string): T {
  return message ? { ...rule, message } : rule;
}

/**
 * Compile authored rule specs into antd `Rule` objects.
 * When no message is set the rule is left bare so antd's own default message
 * (which interpolates the field label) applies.
 */
export function compileRules(specs: RuleSpec[], fieldType: FieldType): AntdRule[] {
  const kind = valueKind(fieldType);
  const rules: AntdRule[] = [];

  for (const spec of specs) {
    switch (spec.kind) {
      case 'required':
        rules.push(withMessage({ required: true }, spec.message));
        break;

      case 'min':
        rules.push(
          withMessage(
            kind === 'string' ? { min: spec.value } : { type: kind, min: spec.value },
            spec.message,
          ) as AntdRule,
        );
        break;

      case 'max':
        rules.push(
          withMessage(
            kind === 'string' ? { max: spec.value } : { type: kind, max: spec.value },
            spec.message,
          ) as AntdRule,
        );
        break;

      case 'len':
        rules.push(withMessage({ len: spec.value }, spec.message) as AntdRule);
        break;

      case 'pattern': {
        // A half-typed regex in the builder must not take down the preview.
        try {
          const pattern = new RegExp(spec.value);
          rules.push(withMessage({ pattern }, spec.message) as AntdRule);
        } catch {
          console.warn(`[form-renderer] ignoring invalid pattern: ${spec.value}`);
        }
        break;
      }

      case 'type':
        rules.push(withMessage({ type: spec.value }, spec.message) as AntdRule);
        break;

      default:
        break;
    }
  }

  return rules;
}

export function hasRequiredRule(specs: RuleSpec[]): boolean {
  return specs.some((spec) => spec.kind === 'required');
}
