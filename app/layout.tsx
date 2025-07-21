import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spotify Playlist Creator',
  description: 'Skapa spellistor med anpassade startpositioner',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv">
      <body className="font-sans">{children}</body>
    </html>
  )
} 