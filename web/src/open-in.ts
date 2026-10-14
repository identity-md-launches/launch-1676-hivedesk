// Vendor deep links retain the complete static-hosting subpath and hash.
export const OPEN_IN = [
  { id: 'metamask', name: 'MetaMask', href: (url: string) => `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, '')}` },
  { id: 'coinbase', name: 'Coinbase Wallet', href: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
  { id: 'rabby', name: 'Rabby', href: (url: string) => `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}` },
  { id: 'phantom', name: 'Phantom', href: (url: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}` },
] as const;

export function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}
