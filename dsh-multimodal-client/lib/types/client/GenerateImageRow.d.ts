import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { MultimodalFace } from './index.ts';
type GenerateImageRowProps = ToolCallViewProps & InjectFace<MultimodalFace>;
/** Resolve session-authorized attachments and render them inline. */
export declare function GenerateImageRow({ block, sessionId, resolveImage }: GenerateImageRowProps): React.ReactNode;
export {};
//# sourceMappingURL=GenerateImageRow.d.ts.map