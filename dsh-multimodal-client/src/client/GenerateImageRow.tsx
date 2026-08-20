/** Inline image row for the generate_image / show_image tool-call cards. */
import { useEffect, useState } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { MultimodalFace } from './index.ts'
import css from './GenerateImageRow.module.css'

interface ImageItem {
  attachmentId: string
  mediaType?: string
  width?: number
  height?: number
  bytes?: number
  name?: string
}

type GenerateImageRowProps = ToolCallViewProps & InjectFace<MultimodalFace>

/** Resolve session-authorized attachments and render them inline. */
export function GenerateImageRow({ block, sessionId, resolveImage }: GenerateImageRowProps): React.ReactNode {
  const isResult = block != null && (block as { kind?: unknown }).kind === 'tool-result'
  const meta = isResult ? (block as { meta?: unknown }).meta : null
  const raw = meta != null && typeof meta === 'object' ? (meta as { images?: unknown }).images : null
  const images: ImageItem[] = Array.isArray(raw) ? raw as ImageItem[] : []
  const key = images.map((image) => image.attachmentId).join(',')
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (images.length === 0) return
    let cancelled = false
    for (const image of images) {
      void resolveImage(sessionId, image.attachmentId).then((url) => {
        if (cancelled) return
        setUrls((previous) => ({ ...previous, [image.attachmentId]: url }))
      }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [sessionId, key, resolveImage])

  if (images.length === 0) {
    if (isResult) {
      const content = (block as { content?: Array<{ type?: string; text?: string }> }).content ?? []
      const text = content.filter((item) => item?.type === 'text').map((item) => item.text ?? '').join('\n')
      return <div className={css.muted}>{text || '生成完成'}</div>
    }
    return <div className={css.muted}>正在生成图片…</div>
  }

  return (
    <div className={css.row}>
      {images.map((image) => {
        const url = urls[image.attachmentId]
        return url
          ? <img key={image.attachmentId} className={css.image} src={url} alt={image.name ?? 'generated'} />
          : <div key={image.attachmentId} className={css.loading}>加载图片…</div>
      })}
    </div>
  )
}
