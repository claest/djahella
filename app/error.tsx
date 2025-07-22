"use client"

import React from "react"

export default function GlobalError({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <html>
      <body style={{ padding: 40, fontFamily: 'sans-serif', background: '#111', color: '#fff' }}>
        <h2>Något gick fel!</h2>
        <pre style={{ color: '#ff5555', background: '#222', padding: 16, borderRadius: 8 }}>{error.message}</pre>
        <button style={{ marginTop: 20, padding: '8px 16px', background: '#1db954', color: '#111', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => reset()}>
          Försök igen
        </button>
      </body>
    </html>
  )
} 