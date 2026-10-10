// Small, original SVG paths for Leaflet's HTML markers. No React server renderer
// or user-provided HTML is included in the browser bundle.
const paths: Record<string, string> = {
  cafe: 'M4 9h12v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3ZM16 10h2a3 3 0 0 1 0 6h-2M7 3v3M11 3v3M3 22h16',
  gourmet: 'M5 3v6a3 3 0 0 0 6 0V3M8 3v19M17 3v10h3M20 3v19',
  shrine: 'M3 4c6 2 12 2 18 0M4 8h16M5 12h14M7 8v13M17 8v13M12 6v6M5 21h4M15 21h4',
  nature: 'M12 2 5 11h4l-5 7h16l-5-7h4ZM12 18v4',
  photo: 'M3 7h4l2-3h6l2 3h4v14H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  shop: 'M3 10 5 3h14l2 7ZM5 10v11h14V10M9 21v-7h6v7M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0',
  other: 'M3 8 7 3h10l4 5-9 14ZM3 8h18M7 3l5 19 5-19',
};
export function categoryMarkerSvg(theme: string) {
  const path = paths[theme] ?? paths.other;
  return `<svg class="app-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}" /></svg>`;
}
