/**
 * Turn-scoped image-accumulator Definition: collects attachment refs from
 * tool/result events, so a turn-tail entry can render the turn's image
 * deliverables as one gallery in the closing output (not only inside
 * individual tool-call cards).
 *
 * Finality: a tool declares its result images as deliverables through the
 * event-level presentationMeta (`data.meta.final === true`, set by
 * generate_image; show_image sets false). Images from explicitly non-final
 * results stay out of the gallery but remain visible in their own tool-call
 * cards. Sessions produced before the final flag degrade gracefully: images
 * with no meta at all still enter the gallery (pre-flag behavior).
 */
import type {
  ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'

interface TurnImageRef {
  readonly seq: number
  readonly attachment: ImageAttachmentRef
}

/** Immutable turn-scoped image facts published against one Turn. */
export interface TurnImagesTurnData {
  readonly images: readonly TurnImageRef[]
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationTurnDataMap {
    /** Attachment refs produced by tools in this Turn (generate_image, show_image, etc.). */
    turnImages: TurnImagesTurnData
  }
}

/** Recursively collect image attachment refs from content blocks. */
function collectImageRefs(content: readonly unknown[]): ImageAttachmentRef[] {
  const refs: ImageAttachmentRef[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const b = block as { type?: string; attachment?: unknown; content?: unknown[] }
    if (b.type === 'image' && b.attachment !== undefined && typeof b.attachment === 'object') {
      refs.push(b.attachment as ImageAttachmentRef)
    } else if (b.type === 'tool-result' && Array.isArray(b.content)) {
      refs.push(...collectImageRefs(b.content))
    }
  }
  return refs
}

/**
 * Read the event-level presentationMeta's final flag. `undefined` means the
 * producer set no meta (pre-flag sessions); `false` is an explicit opt-out.
 */
function readMetaFinal(meta: unknown): boolean | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const final = (meta as { final?: unknown }).final
  return typeof final === 'boolean' ? final : undefined
}

/** Turn-local image accumulator; publishes no view Node. */
export const turnImagesDefinition: ConversationNodeDefinition<{ turn: number; images: TurnImageRef[] }> = {
  kind: 'turnImages',
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/result') return { id: String(event.data.turn), role: 'update' }
    return null
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('turnImages start requires turn/start')
    return { turn: match.event.data.turn, images: [] }
  },
  update: (context, match) => {
    if (match.event.type !== 'tool/result') return context.state
    const data = match.event.data as { message?: unknown; meta?: unknown }
    const message = data.message as { content?: unknown[] } | undefined
    if (message === undefined) return context.state
    // Finality comes from the event-level meta (data.meta), the durable home
    // of presentationMeta; "no meta" degrades to final (pre-flag sessions
    // always showed their images), an explicit false opts out.
    const final = readMetaFinal(data.meta)
    if (final === false) return context.state
    // Images come from the render content (image blocks, nested included) —
    // the content path is what the durable log actually carries.
    const refs = collectImageRefs(message.content ?? [])
    if (refs.length === 0) return context.state
    // Dedup by attachmentId.
    const seen = new Set<string>(context.state.images.map(r => String(r.attachment.attachmentId)))
    const additions: TurnImageRef[] = []
    for (const ref of refs) {
      const id = String(ref.attachmentId)
      if (seen.has(id)) continue
      seen.add(id)
      additions.push({ seq: match.event.seq, attachment: ref })
    }
    if (additions.length === 0) return context.state
    return { ...context.state, images: [...context.state.images, ...additions] }
  },
  buildLocationData: (context, scope) => scope !== 'turn' || context.state === undefined
    ? null
    : {
      kind: 'turn',
      turn: context.state.turn,
      key: 'turnImages',
      value: { images: context.state.images },
    },
}

/**
 * Claim the turn-tail chain only when the turn produced images.
 * @param owner - Turn-tail owner currency for the closing assistant.
 * @returns Image refs as the component's match, or null to decline.
 */
export function selectTurnImages(owner: TurnTailOwnerProps): readonly TurnImageRef[] | null {
  const data = owner.turn.data.get('turnImages')
  if (data === undefined) return null
  const filtered = data.images.filter(ref => ref.seq <= owner.seq)
  return filtered.length === 0 ? null : filtered
}
