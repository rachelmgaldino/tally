import { DEMO } from './config'
import { t } from './i18n'
import { supabase } from './supabase'
import type { Attachment } from './types'

const BUCKET = 'attachments'
export const MAX_ATTACHMENT_BYTES = DEMO ? 1_000_000 : 10 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function uploadAttachment(transactionId: string, file: File): Promise<Attachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(t().settings.attachments.tooBig(file.name, Math.round(MAX_ATTACHMENT_BYTES / 1_000_000)))
  }
  if (DEMO) return { path: await readAsDataUrl(file), name: file.name, size: file.size }
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) throw new Error(t().settings.sessionExpired)
  // Storage keys can't hold every character; the original name is kept in `name`.
  const safe = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_')
  const path = `${userId}/${transactionId}/${Date.now()}-${safe}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return { path, name: file.name, size: file.size }
}

/** Opens the file in a new tab. The tab is opened first so pop-up blockers allow it. */
export async function openAttachment(a: Attachment) {
  const tab = window.open('', '_blank')
  try {
    let url: string
    if (DEMO) {
      url = URL.createObjectURL(await (await fetch(a.path)).blob())
    } else {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.path, 300)
      if (error) throw error
      url = data.signedUrl
    }
    if (tab) tab.location.href = url
    else window.location.href = url
  } catch (e) {
    tab?.close()
    throw e
  }
}

export async function removeAttachments(list: Attachment[]) {
  if (DEMO || list.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(list.map((a) => a.path))
  if (error) throw error
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', t().settings.attachments.decimal)} MB`
}
