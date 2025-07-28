'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Logga felet för debugging
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-spotify-black flex items-center justify-center p-4">
      <div className="bg-spotify-dark rounded-lg p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          Något gick fel
        </h2>
        <p className="text-gray-300 mb-6">
          Ett oväntat fel uppstod. Detta kan bero på att sidan behöver laddas om.
        </p>
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-spotify-green text-white rounded hover:bg-green-600 transition-colors"
          >
            Försök igen
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Ladda om sidan
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="text-gray-400 cursor-pointer mb-2">
              Teknisk information (endast utveckling)
            </summary>
            <pre className="text-xs text-gray-500 bg-black p-3 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
} 