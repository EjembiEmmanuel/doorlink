import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { isConnected } from '../integrations'
import {
  AI_MODEL,
  SYSTEM_PROMPT,
  buildUserPrompt,
  errored,
  interpretReview,
  notRun,
  reviewSchema,
  type ReviewOutcome,
} from './ai-review'
import type { AcceptedMime } from './submission-files'

// The networked half of the AI check. Everything decidable without a
// network lives in ai-review.ts and is tested there.

const TIMEOUT_MS = 120_000

export interface ReviewRequest {
  bytes: Uint8Array
  mime: AcceptedMime
  manufacturerName: string
  productName: string
  modelCode: string
  description?: string | null
}

/**
 * Word documents are not sent.
 *
 * The API takes PDFs and images; a .doc or .docx would have to be
 * converted first, and there is no converter here. Rather than send
 * something the model cannot read and record whatever it says about it,
 * these report NOT_RUN and go to a person — which is where an unreadable
 * submission belongs anyway.
 */
function toContentBlock(bytes: Uint8Array, mime: AcceptedMime) {
  const data = Buffer.from(bytes).toString('base64')
  if (mime === 'application/pdf') {
    return {
      type: 'document' as const,
      source: { type: 'base64' as const, media_type: 'application/pdf' as const, data },
    }
  }
  if (mime === 'image/jpeg' || mime === 'image/png') {
    return {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: mime, data },
    }
  }
  return null
}

/**
 * Check one submitted document.
 *
 * Never throws. Every failure path returns a ReviewOutcome saying what
 * went wrong, because the caller's job is to record the outcome and move
 * the submission along — an exception here would leave a submission
 * stuck in CHECKING with nothing said about why.
 */
export async function runAiReview(request: ReviewRequest): Promise<ReviewOutcome> {
  if (!isConnected('ai')) {
    return notRun('No AI provider is configured, so no automated check ran on this document.')
  }

  const block = toContentBlock(request.bytes, request.mime)
  if (!block) {
    return notRun(
      'Word documents are not sent for automated checking — the API reads PDFs and images, and Doorlink does not convert. A person needs to open this one.'
    )
  }

  try {
    const client = new Anthropic({ timeout: TIMEOUT_MS })
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      messages: [
        {
          role: 'user',
          content: [block, { type: 'text', text: buildUserPrompt(request) }],
        },
      ],
      output_config: { format: zodOutputFormat(reviewSchema) },
    })

    // A refusal is a real answer about the document and is recorded as
    // one, rather than being flattened into a parse failure.
    if (response.stop_reason === 'refusal') {
      return errored(
        'The automated check declined to analyse this document. A person should open it.'
      )
    }

    const parsed = response.parsed_output
    if (!parsed) {
      return errored('The automated check returned nothing usable. A person should open it.')
    }

    return interpretReview(parsed)
  } catch (error) {
    // Deliberately broad. Whatever went wrong — rate limit, timeout,
    // bad key, malformed PDF — the submission still needs to reach a
    // reviewer, and the message is kept so they know a check was tried.
    const detail = error instanceof Error ? error.message : 'unknown error'
    return errored(`The automated check could not complete: ${detail}`)
  }
}
