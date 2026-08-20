/**
 * Multimodal client plugin, browser half. Registers:
 * - inline image rows for the `generate_image` / `show_image` tool-call cards
 * - the turn-tail gallery collecting every image a turn produced
 * - the multimodal settings section (models / endpoints / API keys) driving
 *   the host plugin's `/global-multimodal/*` routes
 *
 * Companion to the dsh-multimodal host plugin.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
/** Resolve one session-authorized attachment to a data URL. */
export interface MultimodalFace {
    resolveImage(sessionId: SessionId, attachmentId: string): Promise<string>;
}
/** Required services: the slot registry, the sessions face, and conversation turn events. */
export declare const inject: string[];
/** Mount the inline-image tool views, the turn-tail gallery, and the settings section. */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map