// Brazilian banks for the account icon picker. We draw a coloured badge with
// a short label instead of copying the banks' logo artwork.
export interface Bank {
  id: string
  name: string
  label: string
  bg: string
  fg: string
}

export const BANKS: Bank[] = [
  { id: 'bb', name: 'Banco do Brasil', label: 'BB', bg: '#fcf000', fg: '#2a3a8c' },
  { id: 'caixa', name: 'Caixa', label: 'CX', bg: '#1c60ab', fg: '#f7a51c' },
  { id: 'itau', name: 'Itaú', label: 'itaú', bg: '#ec7000', fg: '#ffffff' },
  { id: 'bradesco', name: 'Bradesco', label: 'B', bg: '#cc092f', fg: '#ffffff' },
  { id: 'nubank', name: 'Nubank', label: 'nu', bg: '#820ad1', fg: '#ffffff' },
  { id: 'nubank-pj', name: 'Nubank PJ', label: 'nu', bg: '#f1e6fa', fg: '#820ad1' },
  { id: 'nubank-uv', name: 'Nubank Ultravioleta', label: 'nu', bg: '#2d0a4e', fg: '#ffffff' },
  { id: 'santander', name: 'Santander', label: 'S', bg: '#ec0000', fg: '#ffffff' },
  { id: 'inter', name: 'Banco Inter', label: 'inter', bg: '#ff7a00', fg: '#ffffff' },
  { id: 'inter-pj', name: 'Banco Inter PJ', label: 'inter', bg: '#fff1e5', fg: '#ff7a00' },
  { id: 'btg', name: 'BTG Pactual', label: 'btg', bg: '#0d2240', fg: '#ffffff' },
  { id: 'c6', name: 'C6 Bank', label: 'C6', bg: '#242424', fg: '#ffffff' },
  { id: 'xp', name: 'XP Investimentos', label: 'XP', bg: '#111111', fg: '#f5c400' },
  { id: 'picpay', name: 'PicPay', label: 'Pic', bg: '#21c25e', fg: '#ffffff' },
  { id: 'mercadopago', name: 'Mercado Pago', label: 'MP', bg: '#00b1ea', fg: '#ffffff' },
  { id: 'pagbank', name: 'PagBank', label: 'Pag', bg: '#1bb99a', fg: '#ffffff' },
  { id: 'neon', name: 'Neon', label: 'neon', bg: '#00e5ff', fg: '#0b1e3f' },
  { id: 'next', name: 'Next', label: 'next', bg: '#00ff5f', fg: '#111111' },
  { id: 'sicoob', name: 'Sicoob', label: 'sicoob', bg: '#003641', fg: '#c9d200' },
  { id: 'sicredi', name: 'Sicredi', label: 'sicredi', bg: '#3fa110', fg: '#ffffff' },
  { id: 'banrisul', name: 'Banrisul', label: 'B', bg: '#0055a4', fg: '#ffffff' },
  { id: 'safra', name: 'Safra', label: 'safra', bg: '#0d1f3c', fg: '#c8a45a' },
  { id: 'original', name: 'Banco Original', label: 'O', bg: '#00a651', fg: '#ffffff' },
  { id: 'pan', name: 'Banco Pan', label: 'pan', bg: '#00aeef', fg: '#ffffff' },
  { id: 'will', name: 'Will Bank', label: 'will', bg: '#ffe500', fg: '#111111' },
  { id: 'bmg', name: 'BMG', label: 'bmg', bg: '#f47920', fg: '#ffffff' },
  { id: 'daycoval', name: 'Daycoval', label: 'D', bg: '#0b3d91', fg: '#ffffff' },
  { id: 'visa', name: 'Visa', label: 'VISA', bg: '#f3f4f1', fg: '#1a1f71' },
  { id: 'mastercard', name: 'Mastercard', label: 'MC', bg: '#f3f4f1', fg: '#eb001b' },
  { id: 'elo', name: 'Elo', label: 'elo', bg: '#111111', fg: '#ffcb05' },
  { id: 'amex', name: 'American Express', label: 'AMEX', bg: '#2e77bb', fg: '#ffffff' },
  { id: 'diners', name: 'Diners', label: 'D', bg: '#f3f4f1', fg: '#0079be' },
]

export function findBank(id: string): Bank | undefined {
  return BANKS.find((b) => b.id === id)
}
