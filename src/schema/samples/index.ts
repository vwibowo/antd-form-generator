import type { FormSchema } from '../schema';
import { kitchenSinkPreset } from './kitchenSink';
import { purchaseRequestPreset } from './purchaseRequest';
import { remoteDataPreset } from './remoteData';

/**
 * Demo schemas offered by the Sample button.
 *
 * Each preset module exports a plain object rather than importing this
 * interface, so nothing here is a dependency of the presets themselves —
 * structural typing does the checking at the declaration below.
 */
export interface SamplePreset {
  /** Stable menu key. */
  key: string;
  label: string;
  /** One line, shown under the label in the Sample menu. */
  description: string;
  create: () => FormSchema;
}

export const SAMPLE_PRESETS: SamplePreset[] = [
  purchaseRequestPreset,
  remoteDataPreset,
  kitchenSinkPreset,
];

/** What a plain click on the Sample button loads. */
export const DEFAULT_SAMPLE_PRESET = purchaseRequestPreset;
