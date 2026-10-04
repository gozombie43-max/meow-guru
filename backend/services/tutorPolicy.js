// @ts-check
import { z } from 'zod';
export const MAX_TUTOR_EXTRACTED_CHARACTERS = 12_000;

export const tutorPolicySchema = z.object({
  TUTOR_DAILY_REQUESTS: z.coerce.number().int().positive().default(100),
  TUTOR_DAILY_ATTACHMENT_BYTES: z.coerce.number().int().positive().default(40 * 1024 * 1024),
  TUTOR_DAILY_TOKEN_ALLOWANCE: z.coerce.number().int().positive().default(10_000_000),
  TUTOR_QUEUED_JOBS: z.coerce.number().int().min(1).max(20).default(4),
  TUTOR_RUNNING_JOBS: z.coerce.number().int().min(1).max(4).default(2),
});

export const tutorPolicy = () => tutorPolicySchema.parse(process.env);
/** Reserve a conservative UTF-8 token upper bound, including system/OCR/vision,
 * output and all three attempts with a possible text-only fallback each time.
 * No refund on failure: provider failures may still consume billed tokens.
 * @param {unknown} input
 * @param {boolean} attachment
 */
export function tutorTokenAllowance(input, attachment) {
  return (Buffer.byteLength(JSON.stringify(input) || '') + 16_000 + 2500 + (attachment ? MAX_TUTOR_EXTRACTED_CHARACTERS * 4 + 256_000 : 0)) * (attachment ? 6 : 1);
}
