/** Turn-tail gallery: every image produced during the turn, rendered inline. */
import { memo, useEffect, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { MultimodalFace } from './index.ts'
import css from './GenerateImageRow.module.css'

export type TurnImagesProps = {
  matched: readonly { attachment: ImageAttachmentRef }[]
  sessionId: SessionId
} & InjectFace<MultimodalFace>

export const TurnImages = memo(function TurnImages({ matched, sessionId, resolveImage }: TurnImagesProps) {
  const key = matched.map(i => i.attachment.attachmentId).join(',')
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (matched.length === 0) return
    let cancelled = false
    for (const image of matched) {
      const id = String(image.attachment.attachmentId)
      if (urls[id]) continue
      void resolveImage(sessionId, id).then((url) => {
        if (cancelled) return
        setUrls((prev) => ({ ...prev, [id]: url }))
      }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [sessionId, key, resolveImage])

  if (matched.length === 0) return null
  return (
    <div className={css.row}>
      {matched.map((image) => {
        const id = String(image.attachment.attachmentId)
        const url = urls[id]
        return url
          ? <img key={id} className={css.image} src={url} alt={image.attachment.name ?? 'image'} />
          : <div key={id} className={css.loading}>加载图片…</div>
      })}
    </div>
  )
})
