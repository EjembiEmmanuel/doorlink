// zod/v4, not the classic `zod` import the rest of this codebase uses.
// The SDK's zodOutputFormat helper is typed against zod/v4 specifically,
// and passing it a classic schema types the parsed result as `{}` —
// which compiles and then loses every field at runtime. Both namespaces
// ship in the installed zod (3.25), so this is a local choice for one
// file rather than a migration anybody else has to care about.
import * as z from 'zod/v4'
import { AiVerdict } from '@prisma/client'

// The AI check on an uploaded manual.
//
// Split from the API call on purpose: the prompt, the schema and the
// mapping from a model's answer to a Doorlink verdict are all decisions
// worth testing, and none of them needs a network. `runAiReview` in
// ai-review-run.ts is the thin part that actually talks to Anthropic.
//
// What this check is for: catching the obvious. Spam, a holiday photo, a
// corrupted file, a manual for a washing machine. What it is NOT for is
// deciding what gets published — see submission-policy.ts. A model that
// is confident and wrong is the failure mode this whole design is built
// around, which is why its most favourable possible answer still only
// moves a submission into a human's queue.

export const AI_MODEL = 'claude-opus-5'

/**
 * What the model is asked to return.
 *
 * Every field is something readable off the document itself. The model
 * is not asked whether the manual "should" be published, or whether the
 * manufacturer is reputable in general — questions it cannot answer from
 * a PDF and would answer anyway.
 */
export const reviewSchema = z.object({
  is_manual: z
    .boolean()
    .describe('True if this document is a user, installation, service or operating manual.'),
  in_scope: z
    .boolean()
    .describe(
      'True if it relates to garage doors, roller shutters, automated gates, automatic doors, openers, or access-control equipment for those.'
    ),
  has_technical_content: z
    .boolean()
    .describe(
      'True if it contains meaningful technical content — procedures, diagrams, specifications, parts — rather than loose images or marketing.'
    ),
  manufacturer_in_document: z
    .string()
    .describe('The manufacturer named in the document, or an empty string if none is visible.'),
  model_in_document: z
    .string()
    .describe('The model designation in the document, or an empty string if none is visible.'),
  metadata_matches: z
    .boolean()
    .describe("True if the document agrees with the manufacturer and model the submitter entered."),
  appears_malicious_or_corrupt: z
    .boolean()
    .describe('True if the file looks like spam, a scam, deliberately misleading, or unreadable.'),
  confidence: z.number().min(0).max(100).describe('How confident you are, 0-100.'),
  reasoning: z
    .string()
    .describe('Two or three sentences a reviewer can check against the document.'),
})

export type AiReview = z.infer<typeof reviewSchema>

export const SYSTEM_PROMPT = [
  'You are checking a document a member of the public uploaded to Doorlink, a library of manuals for garage doors, roller shutters, gates and automatic doors.',
  '',
  'Report only what you can see in the document. If a field is not visible, say so with an empty string rather than inferring it from the file name or from the submitter.',
  '',
  'You are not deciding whether this gets published. A person does that, and they read your reasoning. Your job is to describe the document accurately, including when you are unsure — a low confidence score is a useful answer, a confident guess is not.',
].join('\n')

export function buildUserPrompt(input: {
  manufacturerName: string
  productName: string
  modelCode: string
  description?: string | null
}): string {
  return [
    'The submitter says this document is:',
    `- Manufacturer: ${input.manufacturerName}`,
    `- Product: ${input.productName}`,
    `- Model: ${input.modelCode}`,
    input.description ? `- Their description: ${input.description}` : null,
    '',
    'Check the document against that and report what you find.',
  ]
    .filter((line) => line !== null)
    .join('\n')
}

export interface ReviewOutcome {
  verdict: AiVerdict
  confidence: number | null
  reasoning: string
}

/**
 * Turn the model's description of a document into a Doorlink verdict.
 *
 * Ordered worst-first so the most serious finding wins. A document can
 * be several kinds of wrong at once and the reviewer should see the
 * reason that matters most, not the first one that happened to be
 * checked.
 */
export function interpretReview(review: AiReview): ReviewOutcome {
  const base = { confidence: review.confidence, reasoning: review.reasoning }

  if (review.appears_malicious_or_corrupt) return { ...base, verdict: AiVerdict.REJECTED }
  if (!review.is_manual) return { ...base, verdict: AiVerdict.REJECTED }
  if (!review.in_scope) return { ...base, verdict: AiVerdict.REJECTED }
  if (!review.has_technical_content) return { ...base, verdict: AiVerdict.REJECTED }

  // A mismatch between the document and what the submitter typed is not
  // grounds for rejection — people mistype model numbers, and the
  // document is the thing that is right. It is grounds for a human to
  // correct the metadata before publishing.
  if (!review.metadata_matches) return { ...base, verdict: AiVerdict.NEEDS_REVIEW }

  return { ...base, verdict: AiVerdict.VERIFIED }
}

/** The outcome recorded when no check could run. Never silent. */
export function notRun(reason: string): ReviewOutcome {
  return { verdict: AiVerdict.NOT_RUN, confidence: null, reasoning: reason }
}

export function errored(reason: string): ReviewOutcome {
  return { verdict: AiVerdict.ERRORED, confidence: null, reasoning: reason }
}
