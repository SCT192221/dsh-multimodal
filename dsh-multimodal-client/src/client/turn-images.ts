/**
 * Turn-scoped image-accumulator Definition: collects attachment refs from
 * tool/result events whose presentationMeta carries images flagged `final`,
 * so a turn-tail entry can render the turn's deliverables as one gallery in
 * the closing output (not only inside individual tool-call cards).
 *
 * `final` is the tool's own declaration that its images are turn deliverables
 * (generate_image sets it true). Non-final producers — show_image displaying
 * intermediate work, or tools whose output merely embeds existing attachments
 * — stay out of the gallery: their images remain visible in their own
 * tool-call cards.
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
    /** Final (deliverable) attachment refs produced by tools in this Turn. */
    turnImages: TurnImagesTurnData
  }
}

/** Read one presentationMeta-shaped object's declared images and final flag. */
function readMeta(meta: unknown): { images: ImageAttachmentRef[]; final: boolean } {
  if (meta === null || typeof meta !== 'object') return { images: [], final: false }
  const m = meta as { images?: unknown; final?: unknown }
  const images: ImageAttachmentRef[] = []
  if (Array.isArray(m.images)) {
    for (const image of m.images) {
      if (image && typeof image === 'object' && typeof (image as { attachmentId?: unknown }).attachmentId === 'string') {
        images.push(image as ImageAttachmentRef)
      }
    }
  }
  return { images, final: m.final === true }
}

/** Turn-local final-image accumulator; publishes no view Node. */
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
    const message = match.event.data.message
    if (message === undefined) return context.state
    // Only presentationMeta declares finality; the render content's image
    // blocks are the same refs the tool already declared there.
    const meta = (message as { meta?: unknown }).meta
    const { images, final } = readMeta(meta)
    if (!final || images.length === 0) return context.state
    // Dedup by attachmentId.
    const seen = new Set<string>(context.state.images.map(r => String(r.attachment.attachmentId)))
    const additions: TurnImageRef[] = []
    for (const ref of images) {
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
 * Claim the turn-tail chain only when the turn produced final images.
 * @param owner - Turn-tail owner currency for the closing assistant.
 * @returns Final image refs as the component's match, or null to decline.
 */
export function selectTurnImages(owner: TurnTailOwnerProps): readonly TurnImageRef[] | null {
  const data = owner.turn.data.get('turnImages')
  if (data === undefined) return null
  const filtered = data.images.filter(ref => ref.seq <= owner.seq)
  return filtered.length === 0 ? null : filtered
}
