/**
 * Multimodal client plugin, browser half. Registers:
 * - inline image rows for the `generate_image` / `show_image` tool-call cards
 * - the turn-tail gallery collecting every image a turn produced
 * - the multimodal settings section (models / endpoints / API keys) driving
 *   the host plugin's `/global-multimodal/*` routes
 *
 * Companion to the dsh-multimodal host plugin.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { AttachmentIdType } from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { GenerateImageRow } from './GenerateImageRow.tsx'
import { TurnImages } from './TurnImages.tsx'
import { turnImagesDefinition, selectTurnImages } from './turn-images.ts'
import { MultimodalSettingsSection } from './MultimodalSettingsSection.tsx'

/** Resolve one session-authorized attachment to a data URL. */
export interface MultimodalFace {
  resolveImage(sessionId: SessionId, attachmentId: string): Promise<string>
}

/** Required services: the slot registry, the sessions face, and conversation turn events. */
export const inject = ['slots', 'sessions', 'conversationEvents']

/** Mount the inline-image tool views, the turn-tail gallery, and the settings section. */
export function apply(ctx: ClientContext): void {
  const face = (): MultimodalFace => ({
    resolveImage(sessionId, attachmentId) {
      const binding = ctx.sessions.binding(sessionId)
      const session = binding === undefined ? undefined : binding.session
      if (session === undefined) return Promise.reject(new Error(`unknown session "${sessionId}"`))
      return session.readAttachment(attachmentId as AttachmentIdType).then((result) => {
        if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
        const { attachment, data } = result.value
        return `data:${attachment.mediaType};base64,${bytesToBase64(data)}`
      })
    },
  })

  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'generate_image',
    inject: face,
  }, GenerateImageRow))

  // show_image shares the same inline-image row: its presentationMeta carries
  // attachment refs the same way generate_image's does.
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'show_image',
    inject: face,
  }, GenerateImageRow))

  // Turn-tail gallery: collect every image produced during the turn (by any
  // tool whose result carries image blocks or presentationMeta images) and
  // render them as one gallery in the closing output, not only inside
  // individual tool-call cards.
  ctx.conversationEvents.register(turnImagesDefinition)
  ctx.slots.inject(
    'conversation.chat.turnTail',
    () => ctx.slots.register({
      name: 'conversation.chat.turnTail',
      select: selectTurnImages,
      inject: face,
    }, TurnImages),
  )

  // Settings section: models, endpoints, and API keys for both channels,
  // talking to the host plugin's /global-multimodal/* routes.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'multimodal',
    order: 15,
    label: () => '多模态',
  }, MultimodalSettingsSection))
}

/** Encode a byte array as base64 (browser-safe, no Buffer). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = Array.from(bytes.subarray(i, Math.min(i + chunk, bytes.length)))
    binary += String.fromCharCode.apply(null, sub)
  }
  return btoa(binary)
}
