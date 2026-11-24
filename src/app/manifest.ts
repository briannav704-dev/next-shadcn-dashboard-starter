import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kouture Life OS',
    short_name: 'Kouture',
    description: 'Private personal and business operating system.',
    start_url: '/life',
    display: 'standalone',
    background_color: '#FBF7F2',
    theme_color: '#FBF7F2',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' }
    ]
  };
}
