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
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client';
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
interface TurnImageRef {
    readonly seq: number;
    readonly attachment: ImageAttachmentRef;
}
/** Immutable turn-scoped image facts published against one Turn. */
export interface TurnImagesTurnData {
    readonly images: readonly TurnImageRef[];
}
declare module '@deepseek-ai/dsh-client-runtime/client' {
    interface ConversationTurnDataMap {
        /** Final (deliverable) attachment refs produced by tools in this Turn. */
        turnImages: TurnImagesTurnData;
    }
}
/** Turn-local final-image accumulator; publishes no view Node. */
export declare const turnImagesDefinition: ConversationNodeDefinition<{
    turn: number;
    images: TurnImageRef[];
}>;
/**
 * Claim the turn-tail chain only when the turn produced final images.
 * @param owner - Turn-tail owner currency for the closing assistant.
 * @returns Final image refs as the component's match, or null to decline.
 */
export declare function selectTurnImages(owner: TurnTailOwnerProps): readonly TurnImageRef[] | null;
export {};
//# sourceMappingURL=turn-images.d.ts.map