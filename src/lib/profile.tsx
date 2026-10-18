import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { DEMO } from './config'
import { t } from './i18n'
import { supabase } from './supabase'

// The profile photo lives in the private attachments bucket, under the user's
// own folder (so the existing storage policy covers it). Its path is kept in
// the user's metadata; demo mode keeps the picture itself in localStorage.

const BUCKET = 'attachments'
const DEMO_KEY = 'tally-demo-avatar'
const SIZE = 256

interface Profile {
  name: string
  email: string
  avatarPath: string | null
  setAvatarPath: (path: string | null) => void
}

const ProfileContext = createContext<Profile>({ name: '', email: '', avatarPath: null, setAvatarPath: () => {} })

export function ProfileProvider({ name, email, avatarPath, children }: { name: string; email: string; avatarPath?: string | null; children: ReactNode }) {
  // Set right after an upload so the photo shows before the session refreshes.
  const [override, setOverride] = useState<string | null | undefined>(() => {
    if (!DEMO) return undefined
    try { return localStorage.getItem(DEMO_KEY) } catch { return null }
  })
  const path = override !== undefined ? override : avatarPath ?? null
  return <ProfileContext.Provider value={{ name, email, avatarPath: path, setAvatarPath: setOverride }}>{children}</ProfileContext.Provider>
}

export const useProfile = () => useContext(ProfileContext)

/** A link the <img> can load. Signed links last a week and are refreshed well before that. */
export function useAvatarUrl(path: string | null) {
  const { data } = useQuery({
    queryKey: ['avatar', path],
    enabled: !!path && !DEMO,
    staleTime: 24 * 3600_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 7 * 24 * 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
  return DEMO ? path : data ?? null
}

/** Crops the picture to a centred square and shrinks it to 256px, so uploads stay tiny. */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error(t().settings.profile.unreadableImage) })
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t().settings.profile.unreadableImage))), 'image/jpeg', 0.85))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Uploads a new photo, replacing the old one. Returns the new path. */
export async function uploadAvatar(file: File, previous: string | null): Promise<string> {
  const blob = await squareJpeg(file)
  if (DEMO) {
    const url = await blobToDataUrl(blob)
    try { localStorage.setItem(DEMO_KEY, url) } catch { /* ignore */ }
    return url
  }
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) throw new Error(t().settings.sessionExpired)
  // A new name each time, so phones don't keep showing a cached old photo.
  const path = `${userId}/profile/avatar-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  const { error: metaError } = await supabase.auth.updateUser({ data: { avatar_path: path } })
  if (metaError) throw metaError
  if (previous) await supabase.storage.from(BUCKET).remove([previous])
  return path
}

export async function removeAvatar(path: string) {
  if (DEMO) {
    try { localStorage.removeItem(DEMO_KEY) } catch { /* ignore */ }
    return
  }
  const { error } = await supabase.auth.updateUser({ data: { avatar_path: null } })
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([path])
}
