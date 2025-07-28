'use client'

import React, { useState, useEffect } from 'react'
import { Track } from '../types/spotify'

interface PlaylistManagerProps {
  playlist: Track[]
  playlistName?: string
  onRemoveTrack: (index: number) => void
  onPlayTrack: (track: Track, startTime?: number) => void
  onPlayNext: () => void
  onPlayPrevious: () => void
  onTogglePlay: () => void
  onVolumeChange: (volume: number) => void
  onShuffle: () => void
  isPlaying: boolean
  currentTrack: any // Kan vara Track eller SpotifyTrack
  currentTime: number
  duration: number
  volume: number
  isShuffled: boolean
  accessToken: string | null
  onLoadPlaylist?: (tracks: Track[], name?: string) => void
  onUpdatePlaylist?: (playlist: Track[]) => void
  currentTrackIndex: number
}

interface SpotifyPlaylist {
  id: string
  name: string
  tracks: {
    total: number
  }
  external_urls: {
    spotify: string
  }
}

interface PlaylistTrack {
  track: Track
  startTime?: number
}

const PlaylistManager: React.FC<PlaylistManagerProps> = ({
  playlist,
  playlistName,
  onRemoveTrack,
  onPlayTrack,
  onPlayNext,
  onPlayPrevious,
  onTogglePlay,
  onVolumeChange,
  onShuffle,
  isPlaying,
  currentTrack,
  currentTime,
  duration,
  volume,
  isShuffled,
  accessToken,
  onLoadPlaylist,
  onUpdatePlaylist,
  currentTrackIndex
}) => {
  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null)
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([])
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false)
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false)
  const [showLocalPlaylistSelector, setShowLocalPlaylistSelector] = useState(false)
  const [localPlaylists, setLocalPlaylists] = useState<any[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [editingPlaylistIndex, setEditingPlaylistIndex] = useState<number | null>(null)
  const [editingPlaylistName, setEditingPlaylistName] = useState('')
  const [editingStartTimeIndex, setEditingStartTimeIndex] = useState<number | null>(null)
  const [editingStartTimeValue, setEditingStartTimeValue] = useState('')
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
  const [overwritePlaylistIndex, setOverwritePlaylistIndex] = useState<number | null>(null)
  const [currentPosition, setCurrentPosition] = useState(0)
  const [trackDuration, setTrackDuration] = useState(0)
  const [isAdjustingStartTime, setIsAdjustingStartTime] = useState(false)
  const [adjustingTrackIndex, setAdjustingTrackIndex] = useState<number | null>(null)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Ladda användarens spellistor
  const loadUserPlaylists = async () => {
    if (!accessToken) return

    setIsLoadingPlaylists(true)
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { // Återställ till 50 - Spotify API max
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUserPlaylists(data.items)
      }
    } catch (error) {
      console.error('Fel vid laddning av spellistor:', error)
    } finally {
      setIsLoadingPlaylists(false)
    }
  }

  // Ladda låtar från vald spellista
  const loadPlaylistTracks = async (playlistId: string) => {
    if (!accessToken) return

    setIsLoadingTracks(true)
    try {
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const tracks: PlaylistTrack[] = data.items
          .filter((item: any) => item.track && item.track.id)
          .map((item: any) => {
            const trackId = item.track.id
            // Försök hitta sparad starttid från localStorage
            const savedStartTime = localStorage.getItem(`starttime_${trackId}`)
            
            return {
              track: {
                id: item.track.id,
                name: item.track.name,
                artists: item.track.artists || [],
                album: item.track.album || { id: '', name: '', images: [] },
                uri: item.track.uri,
                duration_ms: item.track.duration_ms,
                external_urls: item.track.external_urls || { spotify: '' }
              },
              startTime: savedStartTime ? parseFloat(savedStartTime) : undefined
            }
          })
        
        setPlaylistTracks(tracks)
        setSelectedPlaylist(userPlaylists.find(p => p.id === playlistId) || null)
        
        // Ladda direkt till huvudspellistan
        const tracksForMainPlaylist: Track[] = tracks.map(pt => ({
          ...pt.track,
          startTime: pt.startTime ? pt.startTime * 1000 : undefined // Konvertera till millisekunder
        }))
        
        const playlistName = userPlaylists.find(p => p.id === playlistId)?.name || ''
        onLoadPlaylist?.(tracksForMainPlaylist, playlistName)
        alert(`Laddade ${tracks.length} låtar från "${playlistName}"`)
      }
    } catch (error) {
      console.error('Fel vid laddning av låtar:', error)
    } finally {
      setIsLoadingTracks(false)
    }
  }

  // Starta justering av starttid
  const startAdjustingStartTime = (trackIndex: number) => {
    console.log('=== START ADJUSTING START TIME ===')
    console.log('Track index:', trackIndex)
    console.log('Track:', playlist[trackIndex])
    
    setIsAdjustingStartTime(true)
    setAdjustingTrackIndex(trackIndex)
    const track = playlist[trackIndex]
    
    if (track) {
      // Sätt startposition baserat på befintlig starttid eller 0
      const startPosition = track.startTime ? track.startTime / 1000 : 0
      console.log('Setting start position:', startPosition)
      setCurrentPosition(startPosition)
      
      // Starta från början för att få korrekt duration
      onPlayTrack(track, 0)
      
      // Scrolla till låten som justeras
      setTimeout(() => {
        const trackElement = document.getElementById(`track-${trackIndex}`)
        if (trackElement) {
          trackElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }

  // Spara starttid för aktuell låt
  const saveStartTime = () => {
    if (adjustingTrackIndex !== null) {
      console.log('=== SAVING START TIME ===')
      console.log('Track index:', adjustingTrackIndex)
      console.log('Current position:', currentPosition)
      console.log('Current playlist length:', playlist.length)
      console.log('Current track:', playlist[adjustingTrackIndex])
      
      // Uppdatera huvudspellistan (detta är alltid vad vi vill göra)
      const newPlaylist = [...playlist]
      const track = newPlaylist[adjustingTrackIndex]
      const newStartTime = currentPosition * 1000 // Konvertera till millisekunder
      
      newPlaylist[adjustingTrackIndex].startTime = newStartTime
      
      // Spara starttid i localStorage
      localStorage.setItem(`starttime_${track.id}`, currentPosition.toString())
      console.log('Saved start time to localStorage:', track.id, currentPosition)
      console.log('New start time in track:', newStartTime)
      console.log('Updated playlist:', newPlaylist)
      
      console.log('Calling onUpdatePlaylist...')
      onUpdatePlaylist?.(newPlaylist)
      
      setIsAdjustingStartTime(false)
      setAdjustingTrackIndex(null)
      alert(`Starttid sparad: ${formatTime(currentPosition)}`)
    }
  }

  // Avbryt justering av starttid
  const cancelAdjustingStartTime = () => {
    setIsAdjustingStartTime(false)
    setAdjustingTrackIndex(null)
  }

  // Formatera tid (sekunder till MM:SS)
  const formatTime = (seconds: number, showMs: boolean = false): string => {
    if (showMs) {
      const totalMs = Math.round(seconds * 1000)
      const minutes = Math.floor(totalMs / 60000)
      const remainingMs = totalMs % 60000
      const secs = Math.floor(remainingMs / 1000)
      const ms = remainingMs % 1000
      return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
    } else {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = Math.floor(seconds % 60)
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }
  }

  // Uppdatera position och duration från Spotify Player
  useEffect(() => {
    if (isAdjustingStartTime) {
      if (!isDraggingSlider) {
        // Använd currentTime från Spotify Player när vi inte drar
        const newPosition = currentTime / 1000 // Konvertera från millisekunder till sekunder
        console.log('Updating position from Spotify Player:', newPosition, 'currentTime:', currentTime)
        setCurrentPosition(newPosition)
      }
      
      // Uppdatera duration från Spotify Player
      if (duration > 0) {
        const newDuration = duration / 1000 // Konvertera från millisekunder till sekunder
        console.log('Updating duration from Spotify Player:', newDuration, 'duration:', duration)
        setTrackDuration(newDuration)
      }
    }
  }, [currentTime, duration, isAdjustingStartTime, isDraggingSlider])

  // Lokal timer för när användaren drar i slider:en
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (isAdjustingStartTime && isDraggingSlider) {
      console.log('Starting local timer for slider drag')
      // Använd lokal timer när användaren drar
      interval = setInterval(() => {
        setCurrentPosition(prev => {
          const newPos = prev + 0.1
          console.log('Local timer position:', newPos)
          return newPos
        })
      }, 100)
    }
    
    return () => {
      if (interval) {
        console.log('Clearing local timer')
        clearInterval(interval)
      }
    }
  }, [isAdjustingStartTime, isDraggingSlider])



  // Hantera scroll för att justera position
  const handlePositionChange = (newPosition: number) => {
    console.log('Position changed to:', newPosition, 'isDragging:', isDraggingSlider)
    
    // Begränsa positionen till giltigt intervall
    const maxPosition = trackDuration || 100
    const clampedPosition = Math.max(0, Math.min(newPosition, maxPosition))
    
    setCurrentPosition(clampedPosition)
    
    // Om vi inte drar, synkronisera med Spotify Player
    if (!isDraggingSlider) {
      console.log('Not dragging, syncing with Spotify Player')
    }
  }

  // Hantera när användaren släpper slider:en
  const handleSliderEnd = async () => {
    console.log('=== SLIDER END ===')
    console.log('Final position before seek:', currentPosition)
    setIsDraggingSlider(false)
    
    // Seeka till positionen i Spotify Player när användaren släpper
    if (accessToken && currentTrack) {
      try {
        const positionMs = Math.floor(currentPosition * 1000)
        console.log('Seeking to position (ms):', positionMs)
        
        const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        
        if (response.ok) {
          console.log('Successfully seeked to position:', currentPosition)
          // Låt Spotify Player uppdatera positionen naturligt
          // Vi behöver inte manuellt synkronisera eftersom useEffect kommer att hantera det
        } else {
          console.log('Failed to seek, but continuing with local state update')
        }
      } catch (error) {
        console.log('Error seeking position, but continuing with local state update:', error)
      }
    }
  }

  // Ladda spellistor när komponenten mountas
  useEffect(() => {
    if (accessToken && showPlaylistSelector) {
      loadUserPlaylists()
    }
  }, [accessToken, showPlaylistSelector])

  // Ladda lokala spellistor när komponenten mountas
  useEffect(() => {
    const savedPlaylists = loadLocalPlaylists()
    setLocalPlaylists(savedPlaylists)
  }, [])

  // Ladda lokalt sparade spellistor
  const loadLocalPlaylists = () => {
    try {
      const savedPlaylists = localStorage.getItem('saved_playlists')
      if (savedPlaylists) {
        const playlists = JSON.parse(savedPlaylists)
        console.log('Found local playlists:', playlists)
        return playlists
      }
    } catch (error) {
      console.error('Error loading local playlists:', error)
    }
    return []
  }

  // Ladda en specifik lokal spellista
  const loadLocalPlaylist = (playlistIndex: number) => {
    try {
      const savedPlaylists = localStorage.getItem('saved_playlists')
      if (savedPlaylists) {
        const playlists = JSON.parse(savedPlaylists)
        if (playlists[playlistIndex]) {
          const playlist = playlists[playlistIndex]
          console.log('Loading local playlist:', playlist.name)
          
          // Ladda låtar med sparade starttider
          const tracksWithStartTimes = playlist.tracks.map((track: any) => ({
            ...track,
            startTime: track.startTime || 0
          }))
          
          onLoadPlaylist?.(tracksWithStartTimes, playlist.name)
          setShowLocalPlaylistSelector(false)
          alert(`Laddade "${playlist.name}" med ${tracksWithStartTimes.length} låtar`)
        }
      }
    } catch (error) {
      console.error('Error loading local playlist:', error)
      alert('Kunde inte ladda den lokala spellistan')
    }
  }

  // Hantera drag start
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', index.toString())
  }

  // Hantera drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  // Hantera drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    setDragOverIndex(null)
  }

  // Hantera drop
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    // Skapa ny array med omorganiserade låtar
    const newPlaylist = [...playlist]
    const draggedTrack = newPlaylist[draggedIndex]
    
    // Ta bort låten från original position
    newPlaylist.splice(draggedIndex, 1)
    
    // Lägg till låten på ny position
    newPlaylist.splice(dropIndex, 0, draggedTrack)
    
    // Uppdatera playlistan
    onUpdatePlaylist?.(newPlaylist)
    
    // Rensa drag states
    setDraggedIndex(null)
    setDragOverIndex(null)
    
    console.log(`Moved track from index ${draggedIndex} to ${dropIndex}`)
    console.log('New playlist order:', newPlaylist.map(t => t.name))
  }

  const handleVolumeChange = async (newVolume: number) => {
    await onVolumeChange(newVolume)
  }

  const savePlaylistToSpotify = async () => {
    if (!accessToken || playlist.length === 0) {
      alert('Ingen spellista att spara eller saknar åtkomst')
      return
    }

    try {
      // Skapa en ny spellista
      const createResponse = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Min Spellista ${new Date().toLocaleDateString('sv-SE')}`,
          description: `Skapad med Spotify Spellista Skapare - ${playlist.length} låtar`,
          public: false
        })
      })

      if (!createResponse.ok) {
        throw new Error('Kunde inte skapa spellista')
      }

      const playlistData = await createResponse.json()
      const playlistId = playlistData.id

      // Lägg till låtar i spellistan - dela upp i chunks om 1000 låtar
      const trackUris = playlist.map(track => track.uri).filter(Boolean)
      const chunkSize = 1000 // Öka från 100 till 1000 låtar per request
      
      for (let i = 0; i < trackUris.length; i += chunkSize) {
        const chunk = trackUris.slice(i, i + chunkSize)
        
        const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: chunk
          })
        })

        if (!addTracksResponse.ok) {
          throw new Error(`Kunde inte lägga till låtar i spellistan (chunk ${Math.floor(i / chunkSize) + 1})`)
        }
        
        console.log(`Lade till ${chunk.length} låtar i spellistan (chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(trackUris.length / chunkSize)})`)
      }

      alert(`Spellista sparad till Spotify! Namn: ${playlistData.name} (${playlist.length} låtar)`)
      
      // Öppna spellistan i Spotify
      window.open(playlistData.external_urls.spotify, '_blank')
      
    } catch (error) {
      console.error('Fel vid sparande av spellista:', error)
      alert(`Kunde inte spara spellista: ${error instanceof Error ? error.message : 'Okänt fel'}`)
    }
  }

  // Spara spellistan med starttider lokalt
  const savePlaylistLocally = () => {
    if (playlist.length === 0) {
      alert('Ingen spellista att spara')
      return
    }

    // Om det finns befintliga spellistor, visa dialog för att välja
    if (localPlaylists.length > 0) {
      setShowOverwriteDialog(true)
    } else {
      // Inga befintliga spellistor, skapa ny
      const suggestedName = playlistName || `Spellista ${new Date().toLocaleDateString('sv-SE')}`
      setEditingPlaylistName(suggestedName)
      setShowSaveDialog(true)
    }
  }

  // Spara som ny spellista
  const saveAsNewPlaylist = () => {
    const suggestedName = playlistName || `Spellista ${new Date().toLocaleDateString('sv-SE')}`
    setEditingPlaylistName(suggestedName)
    setShowSaveDialog(true)
    setShowOverwriteDialog(false)
  }

  // Spara över befintlig spellista
  const saveOverExistingPlaylist = (index: number) => {
    const playlistData = {
      name: localPlaylists[index].name,
      tracks: playlist,
      savedAt: new Date().toISOString()
    }

    const playlists = [...localPlaylists]
    playlists[index] = playlistData
    localStorage.setItem('saved_playlists', JSON.stringify(playlists))

    // Uppdatera lokala spellistor
    setLocalPlaylists(playlists)
    setShowOverwriteDialog(false)

    alert(`Spellista "${playlistData.name}" uppdaterades! Starttider kommer att laddas automatiskt nästa gång.`)
  }

  // Bekräfta spara med valt namn
  const confirmSavePlaylist = () => {
    if (!editingPlaylistName.trim()) {
      alert('Ange ett namn för spellistan')
      return
    }

    const playlistData = {
      name: editingPlaylistName.trim(),
      tracks: playlist,
      savedAt: new Date().toISOString()
    }

    const playlists = JSON.parse(localStorage.getItem('saved_playlists') || '[]')
    playlists.push(playlistData)
    localStorage.setItem('saved_playlists', JSON.stringify(playlists))

    // Uppdatera lokala spellistor
    setLocalPlaylists(playlists)
    setShowSaveDialog(false)
    setEditingPlaylistName('')

    alert(`Spellista "${playlistData.name}" sparad lokalt! Starttider kommer att laddas automatiskt nästa gång.`)
  }

  const toggleShuffle = () => {
    onShuffle()
  }

  // Rensa sparad starttid för en låt
  const clearStartTime = (trackId: string) => {
    localStorage.removeItem(`starttime_${trackId}`)
    console.log('Cleared start time for track:', trackId)
  }

  // Ladda vald spellista till huvudspellistan
  const loadSelectedPlaylist = () => {
    if (selectedPlaylist && playlistTracks.length > 0) {
      // Konvertera PlaylistTrack[] till Track[] för huvudspellistan
      const tracks: Track[] = playlistTracks.map(pt => ({
        ...pt.track,
        startTime: pt.startTime ? pt.startTime * 1000 : undefined // Konvertera till millisekunder
      }))
      
      alert(`Laddade ${playlistTracks.length} låtar från "${selectedPlaylist.name}"`)
      onLoadPlaylist?.(tracks)
    }
  }

  // Starta redigering av spellistanamn
  const startRenamePlaylist = (index: number) => {
    const playlist = localPlaylists[index]
    setEditingPlaylistIndex(index)
    setEditingPlaylistName(playlist.name)
    setShowRenameDialog(true)
  }

  // Bekräfta namnändring
  const confirmRenamePlaylist = () => {
    if (!editingPlaylistName.trim() || editingPlaylistIndex === null) {
      alert('Ange ett namn för spellistan')
      return
    }

    const playlists = [...localPlaylists]
    playlists[editingPlaylistIndex].name = editingPlaylistName.trim()
    localStorage.setItem('saved_playlists', JSON.stringify(playlists))

    // Uppdatera lokala spellistor
    setLocalPlaylists(playlists)
    setShowRenameDialog(false)
    setEditingPlaylistIndex(null)
    setEditingPlaylistName('')

    alert(`Spellistan döptes om till "${editingPlaylistName.trim()}"`)
  }

  // Ta bort lokal spellista
  const deleteLocalPlaylist = (index: number) => {
    if (!confirm('Är du säker på att du vill ta bort denna spellista?')) {
      return
    }

    const playlists = [...localPlaylists]
    const deletedPlaylist = playlists.splice(index, 1)[0]
    localStorage.setItem('saved_playlists', JSON.stringify(playlists))

    // Uppdatera lokala spellistor
    setLocalPlaylists(playlists)
    alert(`Spellistan "${deletedPlaylist.name}" togs bort`)
  }

  // Starta redigering av starttid via textruta
  const startEditingStartTime = (index: number) => {
    const track = playlist[index]
    setEditingStartTimeIndex(index)
    setEditingStartTimeValue(track.startTime ? track.startTime.toString() : '0')
  }

  // Bekräfta redigering av starttid
  const confirmEditStartTime = () => {
    if (editingStartTimeIndex === null) return

    const newStartTime = parseInt(editingStartTimeValue)
    if (isNaN(newStartTime) || newStartTime < 0) {
      alert('Ange ett giltigt positivt nummer för millisekunder')
      return
    }

    const newPlaylist = [...playlist]
    newPlaylist[editingStartTimeIndex].startTime = newStartTime

    // Spara i localStorage
    const track = newPlaylist[editingStartTimeIndex]
    localStorage.setItem(`starttime_${track.id}`, (newStartTime / 1000).toString())

    onUpdatePlaylist?.(newPlaylist)
    setEditingStartTimeIndex(null)
    setEditingStartTimeValue('')

    console.log(`Updated start time for track ${track.name} to ${newStartTime}ms`)
  }

  // Avbryt redigering av starttid
  const cancelEditStartTime = () => {
    setEditingStartTimeIndex(null)
    setEditingStartTimeValue('')
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Spellista</h2>
      
      {/* Ladda befintlig spellista */}
      <div className="mb-6">
        <button
          onClick={() => setShowPlaylistSelector(!showPlaylistSelector)}
          className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 mb-3"
        >
          {showPlaylistSelector ? 'Dölj' : 'Ladda befintlig Spotify-spellista'}
        </button>

        {/* Ladda lokal spellista */}
        <button
          onClick={() => setShowLocalPlaylistSelector(!showLocalPlaylistSelector)}
          className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 mb-3"
        >
          {showLocalPlaylistSelector ? 'Dölj' : 'Ladda lokal spellista'}
        </button>

        {showLocalPlaylistSelector && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Lokala spellistor</h3>
            {localPlaylists.length === 0 ? (
              <p className="text-gray-400">Inga lokala spellistor hittades</p>
            ) : (
              <div className="space-y-2">
                {localPlaylists.map((playlist, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div 
                        onClick={() => loadLocalPlaylist(index)}
                        className="flex-1 cursor-pointer"
                      >
                        <h4 className="text-white font-medium">{playlist.name}</h4>
                        <p className="text-gray-400 text-sm">
                          {playlist.tracks.length} låtar
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-gray-400 text-sm">
                          {new Date(playlist.savedAt).toLocaleDateString('sv-SE')}
                        </div>
                        <button
                          onClick={() => startRenamePlaylist(index)}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          title="Byt namn"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteLocalPlaylist(index)}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          title="Ta bort"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Spara dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
              <h3 className="text-lg font-semibold mb-4 text-white">Spara spellista</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Namn på spellistan:
                </label>
                <input
                  type="text"
                  value={editingPlaylistName}
                  onChange={(e) => setEditingPlaylistName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder="Ange namn..."
                  autoFocus
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={confirmSavePlaylist}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Spara
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false)
                    setEditingPlaylistName('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Spara över dialog */}
        {showOverwriteDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
              <h3 className="text-lg font-semibold mb-4 text-white">Spara spellista</h3>
              <p className="text-gray-300 mb-4">Välj hur du vill spara spellistan:</p>
              
              <div className="space-y-3 mb-4">
                <button
                  onClick={saveAsNewPlaylist}
                  className="w-full p-3 bg-blue-600 text-white rounded hover:bg-blue-700 text-left"
                >
                  <div className="font-medium">Spara som ny spellista</div>
                  <div className="text-sm text-blue-200">Skapa en ny spellista med nytt namn</div>
                </button>
                
                <div className="text-sm text-gray-400 mb-2">Eller spara över befintlig:</div>
                {localPlaylists.map((playlist, index) => (
                  <button
                    key={index}
                    onClick={() => saveOverExistingPlaylist(index)}
                    className="w-full p-3 bg-gray-700 text-white rounded hover:bg-gray-600 text-left border border-gray-600"
                  >
                    <div className="font-medium">{playlist.name}</div>
                    <div className="text-sm text-gray-400">
                      {playlist.tracks.length} låtar • {new Date(playlist.savedAt).toLocaleDateString('sv-SE')}
                    </div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowOverwriteDialog(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        {/* Byt namn dialog */}
        {showRenameDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
              <h3 className="text-lg font-semibold mb-4 text-white">Byt namn på spellista</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nytt namn:
                </label>
                <input
                  type="text"
                  value={editingPlaylistName}
                  onChange={(e) => setEditingPlaylistName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                  placeholder="Ange nytt namn..."
                  autoFocus
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={confirmRenamePlaylist}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Spara
                </button>
                <button
                  onClick={() => {
                    setShowRenameDialog(false)
                    setEditingPlaylistIndex(null)
                    setEditingPlaylistName('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        )}

        {showPlaylistSelector && (
          <div className="border border-gray-700 rounded-lg p-4 bg-spotify-dark">
            {isLoadingPlaylists ? (
              <p className="text-white">Laddar spellistor...</p>
            ) : (
              <div>
                <h3 className="font-semibold mb-3 text-white">Dina Spotify-spellistor:</h3>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {userPlaylists.map(playlist => (
                    <div key={playlist.id} className="flex justify-between items-center p-3 bg-spotify-black rounded border border-gray-600">
                      <div>
                        <p className="font-medium text-white">{playlist.name}</p>
                        <p className="text-sm text-spotify-light">{playlist.tracks.total} låtar</p>
                      </div>
                      <button
                        onClick={() => loadPlaylistTracks(playlist.id)}
                        className="px-3 py-1 bg-spotify-green text-white text-sm rounded hover:bg-green-600"
                      >
                        Ladda
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPlaylist && (
              <div className="mt-4">
                <h4 className="font-semibold mb-3 text-white">Vald spellista: {selectedPlaylist.name}</h4>
                {isLoadingTracks ? (
                  <p className="text-white">Laddar låtar...</p>
                ) : (
                  <div>
                    <p className="text-white mb-3">
                      {playlistTracks.length} låtar laddade till huvudspellistan.
                      Du kan nu justera starttider direkt i huvudspellistan.
                    </p>
                    <button
                      onClick={() => setShowPlaylistSelector(false)}
                      className="w-full px-4 py-2 bg-spotify-green text-white font-semibold rounded-lg hover:bg-green-600"
                    >
                      Stäng
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Justering av starttid */}
      {isAdjustingStartTime && (
        <div className="mb-6 p-4 bg-spotify-dark border border-spotify-green rounded-lg">
          <h3 className="font-semibold mb-3 text-white">Justera starttid</h3>
          <p className="text-sm mb-3 text-spotify-light">
            Låt spelar nu. Dra i slider:en för att hitta rätt starttid.
          </p>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-spotify-light mb-2">
              <span>0 ms</span>
              <span className="font-mono text-lg text-spotify-green">
                {Math.round(currentPosition * 1000)} ms
              </span>
              <span>{Math.round(trackDuration * 1000)} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max={trackDuration || 100}
              value={currentPosition}
              onChange={(e) => handlePositionChange(Number(e.target.value))}
              onMouseDown={() => setIsDraggingSlider(true)}
              onMouseUp={handleSliderEnd}
              onTouchStart={() => setIsDraggingSlider(true)}
              onTouchEnd={handleSliderEnd}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-gray-400">
                <p>Debug: currentTime={currentTime}ms, duration={duration}ms</p>
                <p>Debug: currentPosition={currentPosition}s, trackDuration={trackDuration}s</p>
                <p>Debug: isDragging={isDraggingSlider ? 'true' : 'false'}</p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={saveStartTime}
              className="px-4 py-2 bg-spotify-green text-white rounded hover:bg-green-600"
            >
              Spara starttid
            </button>
            <button
              onClick={cancelAdjustingStartTime}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Befintlig spellista */}
      {playlist.length === 0 ? (
        <p className="text-gray-500">Inga låtar i spellistan än.</p>
      ) : (
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">
            Din spellista ({playlist.length} låtar)
            <span className="text-sm text-gray-400 ml-2">
              Debug: currentTrackIndex={currentTrackIndex}
            </span>
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            💡 Dra och släpp låtarna för att ändra ordningen. Använd ⋮⋮-handtaget eller dra hela låtraden.
          </p>
          {playlist.map((track, index) => (
            <div
              key={track.id}
              id={`track-${index}`}
              className={`bg-spotify-dark rounded-lg p-4 border transition-all duration-200 cursor-move ${
                draggedIndex === index
                  ? 'border-spotify-green opacity-50 scale-95'
                  : dragOverIndex === index
                  ? 'border-blue-400 bg-blue-900/20'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => setDraggedIndex(null)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* Drag handle */}
                  <div className="text-gray-400 hover:text-white cursor-move">
                    ⋮⋮
          </div>
          
                  {track.album.images[0]?.url && (
                    <img src={track.album.images[0].url} alt={track.name} className="w-12 h-12 rounded" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-white">{track.name}</p>
                    <p className="text-sm text-spotify-light">{track.artists[0]?.name || 'Okänd artist'}</p>
                    {track.startTime && (
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-xs text-spotify-green">
                          Starttid: {track.startTime} ms
                        </p>
                        <button
                          onClick={() => startEditingStartTime(index)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                          title="Redigera starttid"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            clearStartTime(track.id)
                            const newPlaylist = [...playlist]
                            newPlaylist[index].startTime = undefined
                            onUpdatePlaylist?.(newPlaylist)
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                          title="Rensa starttid"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    
                    {/* Redigera starttid textruta */}
                    {editingStartTimeIndex === index && (
                      <div className="mt-2 p-2 bg-gray-700 rounded border border-gray-600">
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={editingStartTimeValue}
                            onChange={(e) => setEditingStartTimeValue(e.target.value)}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-xs"
                            placeholder="Ange millisekunder..."
                            min="0"
                            autoFocus
                          />
                          <span className="text-xs text-gray-400">ms</span>
                          <button
                            onClick={confirmEditStartTime}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Spara
                          </button>
                          <button
                            onClick={cancelEditStartTime}
                            className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                          >
                            Avbryt
                          </button>
                        </div>
                  </div>
                    )}
                    {/* Debug info */}
                    <p className="text-xs text-gray-500 mt-1">
                      Debug: startTime={track.startTime ? `${track.startTime}ms` : 'undefined'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      console.log('=== SPELA KNAPP KLICKAD ===')
                      console.log('Track:', track.name)
                      console.log('Track startTime (ms):', track.startTime)
                      const startTimeInSeconds = track.startTime ? track.startTime / 1000 : undefined
                      console.log('Sending startTime (seconds):', startTimeInSeconds)
                      onPlayTrack(track, startTimeInSeconds)
                    }}
                    className="px-3 py-1 bg-spotify-green text-white text-sm rounded hover:bg-green-600"
                  >
                    Spela
                  </button>
                  <button
                    onClick={() => {
                      // Starta justering av starttid för denna låt
                      setCurrentPosition(track.startTime ? track.startTime / 1000 : 0)
                      setTrackDuration(track.duration_ms / 1000)
                      setIsAdjustingStartTime(true)
                      setAdjustingTrackIndex(index)
                      onPlayTrack(track, 0) // Starta från början
                    }}
                    className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                  >
                    Justera starttid
                  </button>
                    <button
                      onClick={() => onRemoveTrack(index)}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      )}

      {/* Kontroller */}
      <div className="space-y-4">
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => {
              console.log('=== PREVIOUS BUTTON CLICKED ===')
              onPlayPrevious()
            }}
            className="p-2 bg-spotify-dark text-white rounded-full hover:bg-gray-700 border border-gray-600"
            title="Föregående låt"
          >
            PREV
          </button>
          <button
            onClick={onTogglePlay}
            className="p-3 bg-spotify-green text-white rounded-full hover:bg-green-600"
            title={isPlaying ? 'Pausa' : 'Spela'}
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <button
            onClick={() => {
              console.log('=== NEXT BUTTON CLICKED ===')
              onPlayNext()
            }}
            className="p-2 bg-spotify-dark text-white rounded-full hover:bg-gray-700 border border-gray-600"
            title="Nästa låt"
          >
            NEXT
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-sm text-white">Volym:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="flex-1 slider"
          />
          <span className="text-sm w-12 text-white">{volume}%</span>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={toggleShuffle}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold ${
              isShuffled
                ? 'bg-spotify-green text-white'
                : 'bg-spotify-dark text-white hover:bg-gray-700 border border-gray-600'
            }`}
          >
            Blanda {isShuffled ? 'PÅ' : 'AV'}
          </button>
        </div>
          
          <div className="mt-6 space-y-3">
          <button 
            onClick={savePlaylistToSpotify}
            className="w-full px-4 py-2 bg-spotify-green text-white font-semibold rounded-lg hover:bg-green-600"
          >
              Spara spellista till Spotify
            </button>
          <button 
            onClick={savePlaylistLocally}
            className="w-full px-4 py-2 bg-spotify-dark text-white font-semibold rounded-lg hover:bg-gray-700 border border-gray-600"
          >
            Spara spellista lokalt
            </button>
          </div>
      </div>
    </div>
  )
} 

export default PlaylistManager 