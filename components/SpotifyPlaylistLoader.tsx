import React, { useState, useEffect } from 'react'
import { Track } from '../types/spotify'

interface SpotifyPlaylist {
  id: string
  name: string
  tracks: {
    total: number
  }
}

interface ExpandedPlaylist {
  id: string
  name: string
  tracks: Track[]
  isExpanded: boolean
  isLoading: boolean
}

interface SpotifyPlaylistLoaderProps {
  accessToken: string | null
  onAddToPlaylist: (track: Track) => void
  onPlayTrack: (track: Track, startTime?: number) => void
  onAddAllToQueue: (tracks: Track[]) => void // Ny prop
}

export default function SpotifyPlaylistLoader({ accessToken, onAddToPlaylist, onPlayTrack, onAddAllToQueue }: SpotifyPlaylistLoaderProps) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [expandedPlaylists, setExpandedPlaylists] = useState<ExpandedPlaylist[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Ladda användarens spellistor när komponenten mountas
  useEffect(() => {
    if (accessToken) {
      loadUserPlaylists()
    }
  }, [accessToken])

  const loadUserPlaylists = async () => {
    if (!accessToken) return

    setIsLoading(true)
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { // Återställ till 50 - Spotify API max
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPlaylists(data.items || [])
      } else {
        console.error('Fel vid laddning av spellistor:', response.status)
      }
    } catch (error) {
      console.error('Fel vid laddning av spellistor:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const togglePlaylistExpansion = async (playlist: SpotifyPlaylist) => {
    const existingPlaylist = expandedPlaylists.find(p => p.id === playlist.id)
    
    if (existingPlaylist) {
      // Om spellistan redan är laddad, bara växla expansion
      setExpandedPlaylists(prev => 
        prev.map(p => 
          p.id === playlist.id 
            ? { ...p, isExpanded: !p.isExpanded }
            : p
        )
      )
    } else {
      // Ladda spellistan för första gången
      setExpandedPlaylists(prev => [
        ...prev,
        {
          id: playlist.id,
          name: playlist.name,
          tracks: [],
          isExpanded: true,
          isLoading: true
        }
      ])

      try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          const tracks: Track[] = data.items
            .filter((item: any) => item.track && item.track.id) // Filtrera bort null tracks
            .map((item: any) => ({
              id: item.track.id,
              name: item.track.name,
              artists: item.track.artists,
              album: item.track.album,
              duration_ms: item.track.duration_ms,
              uri: item.track.uri,
              startTime: undefined // Ladda inte med starttider från Spotify
            }))

          setExpandedPlaylists(prev => 
            prev.map(p => 
              p.id === playlist.id 
                ? { ...p, tracks, isLoading: false }
                : p
            )
          )
          
          console.log(`Laddade spellista "${playlist.name}" med ${tracks.length} låtar`)
        } else {
          console.error('Fel vid laddning av spellista:', response.status)
          // Ta bort spellistan om laddningen misslyckades
          setExpandedPlaylists(prev => prev.filter(p => p.id !== playlist.id))
        }
      } catch (error) {
        console.error('Fel vid laddning av spellista:', error)
        // Ta bort spellistan om laddningen misslyckades
        setExpandedPlaylists(prev => prev.filter(p => p.id !== playlist.id))
      }
    }
  }

  const removeExpandedPlaylist = (playlistId: string) => {
    setExpandedPlaylists(prev => prev.filter(p => p.id !== playlistId))
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="text-gray-400">Laddar spellistor...</div>
      ) : playlists.length === 0 ? (
        <div className="text-gray-400">Inga spellistor hittades</div>
      ) : (
        <div className="space-y-3">
          {/* Lista över alla spellistor */}
          <div className="space-y-2">
            {playlists.map((playlist) => {
              const isExpanded = expandedPlaylists.some(p => p.id === playlist.id && p.isExpanded)
              const isLoading = expandedPlaylists.some(p => p.id === playlist.id && p.isLoading)
              const expanded = expandedPlaylists.find(p => p.id === playlist.id)
              return (
                <div key={playlist.id} className="bg-spotify-black p-3 rounded border border-gray-700">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-white font-medium">{playlist.name}</p>
                      <p className="text-sm text-gray-400">{playlist.tracks.total} låtar</p>
                    </div>
                    <button
                      onClick={() => togglePlaylistExpansion(playlist)}
                      disabled={isLoading}
                      className="px-3 py-1 bg-spotify-green text-black text-sm rounded hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Laddar...' : isExpanded ? 'Dölj' : 'Visa'}
                    </button>
                    <button
                      onClick={async () => {
                        if (expanded && expanded.tracks.length > 0) {
                          onAddAllToQueue(expanded.tracks)
                        } else {
                          // Ladda spellistans tracks först
                          const response = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
                            headers: {
                              'Authorization': `Bearer ${accessToken}`
                            }
                          })
                          if (response.ok) {
                            const data = await response.json()
                            const tracks: Track[] = data.items
                              .filter((item: any) => item.track && item.track.id)
                              .map((item: any) => ({
                                id: item.track.id,
                                name: item.track.name,
                                artists: item.track.artists,
                                album: item.track.album,
                                duration_ms: item.track.duration_ms,
                                uri: item.track.uri,
                                startTime: undefined
                              }))
                            onAddAllToQueue(tracks)
                          }
                        }
                      }}
                      disabled={isLoading}
                      className="px-3 py-1 bg-spotify-green text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Lägg till alla i kö
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Expandera spellistor */}
          {expandedPlaylists.filter(p => p.isExpanded).map((playlist) => (
            <div key={playlist.id} className="bg-spotify-dark p-4 rounded border border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-white font-medium">{playlist.name}</h5>
                <button
                  onClick={() => removeExpandedPlaylist(playlist.id)}
                  className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  title="Ta bort från listan"
                >
                  ✕
                </button>
              </div>
              
              {playlist.isLoading ? (
                <div className="text-gray-400">Laddar låtar...</div>
                             ) : (
                                  <div className="space-y-2">
                   {playlist.tracks.map((track) => (
                     <div 
                       key={track.id} 
                       draggable
                       onDragStart={(e) => {
                         e.dataTransfer.setData('application/json', JSON.stringify(track))
                         console.log('Drag start from Spotify playlist:', track.name)
                       }}
                       className="flex items-center space-x-3 p-2 bg-spotify-black rounded border border-gray-700 cursor-move hover:border-gray-600 transition-colors"
                     >
                       <div className="text-gray-400 text-sm cursor-move" title="Dra för att lägga till i kö">⋮⋮</div>
                       {track.album?.images?.[0]?.url && (
                         <img src={track.album.images[0].url} alt={track.name} className="w-8 h-8 rounded" />
                       )}
                       <div className="flex-1 min-w-0">
                         <p 
                           className="text-white text-sm font-medium truncate cursor-pointer hover:text-spotify-green transition-colors"
                           onClick={() => onPlayTrack(track)}
                           title="Klicka för att spela"
                         >
                           {track.name}
                         </p>
                         <p className="text-xs text-gray-400 truncate">
                           {track.artists?.[0]?.name || 'Okänd artist'}
                         </p>
                       </div>
                       <button
                         onClick={() => onAddToPlaylist(track)}
                         className="px-2 py-1 bg-spotify-green text-black text-xs rounded hover:bg-green-400"
                         title="Lägg till i kö"
                       >
                         +
                       </button>
                     </div>
                   ))}
                 </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 