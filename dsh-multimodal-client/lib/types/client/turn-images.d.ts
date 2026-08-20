/**
 * Turn-scoped image-accumulator Definition: collects attachment refs from
 * tool/result events whose content or presentationMeta carry image blocks,
 * so a turn-tail entry can render every image the turn produced as one
 * gallery in the closing output (not only inside individual tool-call cards).
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
        /** Attachment refs produced by tools in this Turn (generate_image, show_image, etc.). */
        turnImages: TurnImagesTurnData;
    }
}
/** Turn-local image accumulator; publishes no view Node. */
export declare const turnImagesDefinition: ConversationNodeDefinition<{
    turn: number;
    images: TurnImageRef[];
}>;
/**
 * Claim the turn-tail chain only when the turn produced images.
 * @param owner - Turn-tail owner currency for the closing assistant.
 * @returns Image refs as the component's match, or null to decline.
 */
export declare function selectTurnImages(owner: TurnTailOwnerProps): readonly TurnImageRef[] | null;
export {};
//# sourceMappingURL=turn-images.d.ts.map