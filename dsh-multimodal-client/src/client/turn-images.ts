/**
 * Turn-scoped image-accumulator Definition: collects attachment refs from
 * tool/result events whose content or presentationMeta carry image blocks,
 * so a turn-tail entry can render every image the turn produced as one
 * gallery in the closing output (not only inside individual tool-call cards).
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
    const message = match.event.data.message
    if (message === undefined) return context.state
    // Image blocks emitted into the tool-result content by render.
    const contentRefs = collectImageRefs(message.content ?? [])
    // presentationMeta images (generate_image/show_image).
    const meta = (message as { meta?: { images?: unknown[] } }).meta
    const metaRefs: ImageAttachmentRef[] = []
    if (meta && Array.isArray(meta.images)) {
      for (const image of meta.images) {
        if (image && typeof image === 'object' && typeof (image as { attachmentId?: unknown }).attachmentId === 'string') {
          metaRefs.push(image as ImageAttachmentRef)
        }
      }
    }
    const all = [...contentRefs, ...metaRefs]
    if (all.length === 0) return context.state
    // Dedup by attachmentId.
    const seen = new Set<string>(context.state.images.map(r => String(r.attachment.attachmentId)))
    const additions: TurnImageRef[] = []
    for (const ref of all) {
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
