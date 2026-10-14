import type { CSSProperties } from 'react';

export type IconName = 'arrow' | 'wallet' | 'copy' | 'check' | 'refresh' | 'clock' | 'chart' | 'activity' | 'shield' | 'close' | 'chevron' | 'external' | 'globe' | 'coin' | 'index' | 'shuffle';
const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  external: <><path d="M14 4h6v6m0-6L10 14" /><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
  wallet: <><path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V7" /><path d="M20 12h-5v5h5m-3-2.5h.1" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M15 8V4H4v11h4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  refresh: <><path d="M20 10a8 8 0 1 0-1 7M20 4v6h-6" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  chart: <><path d="M4 4v16h16M8 15l4-4 3 2 5-7" /></>,
  activity: <><path d="M4 6h16M4 12h10M4 18h13" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6Z" /><path d="m8 12 3 3 5-6" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M10 6v12m3-12v2m0 8v2M8 8h6a2 2 0 0 1 0 4H9h6a2 2 0 0 1 0 4H8" /></>,
  index: <><path d="M4 20V10h4v10m4 0V4h4v16m4 0v-6M2 20h20" /></>,
  shuffle: <><path d="m17 3 4 4-4 4m0 2 4 4-4 4M3 7h4l10 10h4M3 17h4l3-3m4-4 3-3h4" /></>,
};
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}>{paths[name]}</svg>;
}
export function HiveMark({ className = '' }: { className?: string }) {
  return <svg className={className} width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false"><path d="m24 5 16 9v20l-16 9-16-9V14Z" fill="currentColor" /><g stroke="var(--color-ink)" strokeWidth="2.3" strokeLinejoin="round"><path d="m24 10 12 7v14l-12 7-12-7V17Z" /><path d="m12 17 12 7 12-7M24 24v14M18 13.5l12 7v10l-12 4" /></g></svg>;
}
