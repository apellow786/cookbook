import type { APIRoute } from 'astro';
import { url } from '../lib/site';

export const GET: APIRoute = () => new Response(JSON.stringify({
  id: url('/'),
  name: "Alexander's Cookbook",
  short_name: 'Cookbook',
  description: 'A personal collection of favorite recipes.',
  lang: 'en',
  start_url: url('/'),
  scope: url('/'),
  display: 'standalone',
  background_color: '#f7efe2',
  theme_color: '#f7efe2',
  icons: [
    { src: url('/icons/cookbook-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: url('/icons/cookbook-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
}, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
