import { deleteEntries, dropFiles, restoreEntries, useRefresh } from '../lib/entries'
import type { Transaction } from '../lib/types'
import { useToast } from './Toast'

/** Deletes entries right away and offers "Desfazer" on the toast; their files go only once that's no longer possible. */
export function useUndoDelete() {
  const refresh = useRefresh()
  const toast = useToast()
  return async (list: Transaction[], message: string) => {
    await refresh(deleteEntries(list, { keepFiles: true }))
    toast(message, {
      action: { label: 'Desfazer', onClick: () => { refresh(restoreEntries(list)).catch((e) => toast(`Não foi possível desfazer: ${(e as Error).message}`)) } },
      onExpire: () => { dropFiles(list) },
    })
  }
}
