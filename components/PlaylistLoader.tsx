'use client'

import { useState, useEffect } from 'react'
import { Track } from '@/types/spotify'

interface PlaylistLoaderProps {
  accessToken: string
  onLoadPlaylist: (tracks: Track[], name: string) => void
}

interface SpotifyPlaylist {
  id: string
  name: string
  tracks: {
    total: number
  }
  images?: Array<{ url: string }>
}

interface LocalPlaylist {
  id: string
  name: string
  tracks: Track[]
  savedAt: string
}

export default function PlaylistLoader({ accessToken, onLoadPlaylist }: PlaylistLoaderProps) {
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([])
  const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([])
  const [loading, setLoading] = useState(false)
  const [showSpotifyList, setShowSpotifyList] = useState(false)
  const [showLocalList, setShowLocalList] = useState(false)

  // Ladda Spotify-spellistor
  const loadSpotifyPlaylists = async () => {
    if (!accessToken) return
    
    setLoading(true)
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { // Återställ till 50 - Spotify API max
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSpotifyPlaylists(data.items)
      } else {
        console.error('Kunde inte ladda Spotify-spellistor')
        alert('Kunde inte ladda Spotify-spellistor. Kontrollera din anslutning.')
      }
    } catch (error) {
      console.error('Fel vid laddning av Spotify-spellistor:', error)
      alert('Ett fel uppstod vid laddning av Spotify-spellistor.')
    } finally {
      setLoading(false)
    }
  }

  // Ladda lokal spellista
  const loadLocalPlaylist = async (playlistId: string) => {
    try {
      const savedPlaylists = localStorage.getItem('spotifyPlaylists')
      if (savedPlaylists) {
        const playlists = JSON.parse(savedPlaylists)
        const playlist = playlists.find((p: LocalPlaylist) => p.id === playlistId)
        if (playlist) {
          onLoadPlaylist(playlist.tracks, playlist.name)
          setShowLocalList(false)
        }
      }
    } catch (error) {
      console.error('Fel vid laddning av lokal spellista:', error)
      alert('Kunde inte ladda den lokala spellistan.')
    }
  }

  // Ladda Spotify-spellista
  const loadSpotifyPlaylist = async (playlistId: string, playlistName: string) => {
    if (!accessToken) return
    
    setLoading(true)
    try {
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const tracks = data.items.map((item: any) => {
          const track = item.track
          if (!track) return null
          
          return {
            id: track.id,
            name: track.name,
            artists: track.artists.map((artist: any) => ({
              id: artist.id,
              name: artist.name,
            })),
            album: {
              id: track.album.id,
              name: track.album.name,
              images: track.album.images,
            },
            duration_ms: track.duration_ms,
            external_urls: track.external_urls,
            preview_url: track.preview_url, // Lägg till preview_url
            uri: track.uri,
          }
        }).filter((track: any) => track !== null)
        
        onLoadPlaylist(tracks, playlistName)
        setShowSpotifyList(false)
      } else {
        console.error('Kunde inte ladda spellista')
        alert('Kunde inte ladda spellistan. Kontrollera din anslutning.')
      }
    } catch (error) {
      console.error('Fel vid laddning av spellista:', error)
      alert('Ett fel uppstod vid laddning av spellistan.')
    } finally {
      setLoading(false)
    }
  }

  // Ladda lokala spellistor från localStorage
  useEffect(() => {
    try {
      const savedPlaylists = localStorage.getItem('spotifyPlaylists')
      if (savedPlaylists) {
        const playlists = JSON.parse(savedPlaylists)
        setLocalPlaylists(playlists)
      }
    } catch (error) {
      console.error('Fel vid laddning av lokala spellistor:', error)
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Spotify-spellistor */}
      <div>
        <button
          onClick={() => {
            if (!showSpotifyList) {
              loadSpotifyPlaylists()
            }
            setShowSpotifyList(!showSpotifyList)
            setShowLocalList(false)
          }}
          className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 mb-3"
        >
          {loading ? 'Laddar...' : 'Ladda Spotify-spellista'}
        </button>
        
        {showSpotifyList && (
          <div className="bg-spotify-black rounded-lg p-4 max-h-60 overflow-y-auto">
            {spotifyPlaylists.length === 0 ? (
              <p className="text-gray-400 text-center">Inga Spotify-spellistor hittades</p>
            ) : (
              <div className="space-y-2">
                {spotifyPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center justify-between p-2 bg-spotify-dark rounded hover:bg-gray-700 cursor-pointer"
                    onClick={() => loadSpotifyPlaylist(playlist.id, playlist.name)}
                  >
                    <div className="flex items-center space-x-3">
                      {playlist.images?.[0]?.url && (
                        <img src={playlist.images[0].url} alt={playlist.name} className="w-8 h-8 rounded" />
                      )}
                      <div>
                        <p className="text-white font-medium">{playlist.name}</p>
                        <p className="text-sm text-gray-400">{playlist.tracks.total} låtar</p>
                      </div>
                    </div>
                    <button className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                      Ladda
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lokala spellistor */}
      <div>
        <button
          onClick={() => {
            setShowLocalList(!showLocalList)
            setShowSpotifyList(false)
          }}
          className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 mb-3"
        >
          Ladda lokal spellista ({localPlaylists.length})
        </button>
        
        {showLocalList && (
          <div className="bg-spotify-black rounded-lg p-4 max-h-60 overflow-y-auto">
            {localPlaylists.length === 0 ? (
              <p className="text-gray-400 text-center">Inga lokala spellistor sparade</p>
            ) : (
              <div className="space-y-2">
                {localPlaylists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center justify-between p-2 bg-spotify-dark rounded hover:bg-gray-700 cursor-pointer"
                    onClick={() => loadLocalPlaylist(playlist.id)}
                  >
                    <div>
                      <p className="text-white font-medium">{playlist.name}</p>
                      <p className="text-sm text-gray-400">
                        {playlist.tracks.length} låtar • Sparad {new Date(playlist.savedAt).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <button className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                      Ladda
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 