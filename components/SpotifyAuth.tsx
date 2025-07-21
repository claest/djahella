'use client'

import { useState, useEffect, useRef } from 'react'
import { spotifyConfig } from '@/config/spotify'

interface SpotifyAuthProps {
  onAuthSuccess: (accessToken: string) => void
}

export default function SpotifyAuth({ onAuthSuccess }: SpotifyAuthProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasProcessedCode = useRef(false)
  
  // Hämta Client ID från miljövariabel
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID

  const handleLogin = () => {
    if (!clientId) {
      setError('Spotify Client ID saknas. Kontrollera att du har skapat .env.local filen.')
      return
    }

    // Förenklad auth URL utan show_dialog för att undvika problem
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(spotifyConfig.redirectUri)}&scope=${encodeURIComponent(spotifyConfig.scopes.join(' '))}`

    console.log('=== Spotify Auth Debug ===')
    console.log('Client ID:', clientId)
    console.log('Redirect URI:', spotifyConfig.redirectUri)
    console.log('Encoded Redirect URI:', encodeURIComponent(spotifyConfig.redirectUri))
    console.log('Full Auth URL:', authUrl)
    console.log('========================')
    
    window.location.href = authUrl
  }

  // Kontrollera om vi kommer tillbaka från Spotify med en authorization code
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')

    console.log('=== useEffect triggered ===')
    console.log('Code exists:', !!code)
    console.log('Error exists:', !!error)
    console.log('hasProcessedCode.current:', hasProcessedCode.current)

    if (code && !hasProcessedCode.current) {
      hasProcessedCode.current = true
      setIsLoading(true)
      console.log('Authorization code received:', code.substring(0, 10) + '...')
      // För Authorization Code Flow behöver vi byta koden mot en access token
      exchangeCodeForToken(code)
    } else if (error) {
      setError(`Autentiseringsfel: ${error}`)
      // Rensa URL:en även vid fel
      window.history.replaceState({}, document.title, window.location.pathname)
    } else {
      console.log('No code or error found, or code already processed')
    }
  }, [])

  const exchangeCodeForToken = async (code: string) => {
    try {
      console.log('Exchanging code for token...')
      console.log('Redirect URI being used:', spotifyConfig.redirectUri)
      
      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, redirectUri: spotifyConfig.redirectUri })
      })

      const responseText = await response.text()
      console.log('Token exchange response:', responseText)

      if (!response.ok) {
        console.error('Token exchange failed:', responseText)
        
        // Försök parsa JSON för bättre felmeddelande
        try {
          const errorData = JSON.parse(responseText)
          if (errorData.error === 'invalid_grant') {
            throw new Error('Authorization code är ogiltig eller har gått ut. Försök logga in igen.')
          }
          throw new Error(`Spotify fel: ${errorData.error_description || errorData.error}`)
        } catch (parseError) {
          throw new Error('Kunde inte byta kod mot token. Kontrollera att du har rätt Client Secret.')
        }
      }

      const data = JSON.parse(responseText)
      console.log('Token exchange successful')
      console.log('About to call onAuthSuccess with token:', data.access_token.substring(0, 20) + '...')
      onAuthSuccess(data.access_token)
      console.log('onAuthSuccess called successfully')
      
      // Rensa URL:en
      window.history.replaceState({}, document.title, window.location.pathname)
    } catch (error) {
      console.error('Fel vid token-utbyte:', error)
      setError(error instanceof Error ? error.message : 'Kunde inte slutföra autentiseringen')
      window.history.replaceState({}, document.title, window.location.pathname)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center space-y-4 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-gray-800">Logga in med Spotify</h2>
      
      {error && (
        <div className="w-full p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="flex items-center space-x-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Loggar in...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <span>Logga in med Spotify</span>
          </>
        )}
      </button>
      
      <div className="text-xs text-gray-500 text-center">
        <p>Du behöver logga in för att använda spellistan</p>
      </div>
    </div>
  )
} 