import type { ScreenSchema } from '../screen';
import { kitchenSinkPreset } from './kitchenSink';
import { welcomePackPreset } from './pages';
import { purchaseRequestPreset } from './purchaseRequest';
import { remoteDataPreset } from './remoteData';
import { reviewAndConfirmPreset } from './reviewAndConfirm';

/**
 * Demo screens offered by the Sample button.
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
  create: () => ScreenSchema;
}

/**
 * One list, because there is one Screen mode.
 *
 * The three kinds of screen, in order: one that only asks
 * (`purchaseRequest`), one that does both (`reviewAndConfirm`), and one that
 * only tells (`welcomePack`). The middle one is what the form/page split made
 * impossible to build.
 */
export const SAMPLE_PRESETS: SamplePreset[] = [
  purchaseRequestPreset,
  reviewAndConfirmPreset,
  remoteDataPreset,
  welcomePackPreset,
  kitchenSinkPreset,
];

/** What a plain click on the Sample button loads. */
export const DEFAULT_SAMPLE_PRESET = purchaseRequestPreset;
