import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'AI Expense Tracker', short_name: 'খরচ', start_url: '/', display: 'standalone', background_color: '#020617', theme_color: '#059669', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] };
}
