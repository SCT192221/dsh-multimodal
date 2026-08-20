import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { MultimodalFace } from './index.ts';
export type TurnImagesProps = {
    matched: readonly {
        attachment: ImageAttachmentRef;
    }[];
    sessionId: SessionId;
} & InjectFace<MultimodalFace>;
export declare const TurnImages: import("react").MemoExoticComponent<({ matched, sessionId, resolveImage }: TurnImagesProps) => import("react").JSX.Element | null>;
//# sourceMappingURL=TurnImages.d.ts.map