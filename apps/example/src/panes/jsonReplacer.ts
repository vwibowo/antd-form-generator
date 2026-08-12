/**
 * dayjs objects and File handles are not JSON — show something readable.
 *
 * Shared by the form preview and the workflow preview, which display the same
 * kind of payload: values straight out of a live antd form, before whatever the
 * host does with them.
 */
export function jsonReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object') {
    const maybeDayjs = value as { isValid?: () => boolean; toISOString?: () => string };
    if (typeof maybeDayjs.isValid === 'function' && typeof maybeDayjs.toISOString === 'function') {
      return maybeDayjs.toISOString();
    }
    if ('originFileObj' in value || 'uid' in value) {
      const file = value as { name?: string; uid?: string };
      return `[file: ${file.name ?? file.uid ?? 'unknown'}]`;
    }
  }
  return value;
}
