'use client'

import { useState, useEffect, useRef } from 'react'
import { Track } from '@/types/spotify'
import SpotifyAuth from '@/components/SpotifyAuth'
import SearchBar from '@/components/SearchBar'
import TrackList from '@/components/TrackList'
import QueueSaver from '@/components/QueueSaver'
import SpotifyPlaylistLoader from '@/components/SpotifyPlaylistLoader'
import QueueManager from '@/components/QueueManager'
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer'
import PlaylistViewer from '@/components/PlaylistViewer'

// --- Server-synk och migrering ---
async function fetchServerQueuesAndStartPoints(userId: string) {
  const res = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return { queues: [], startPoints: {} }
  return await res.json()
}

async function saveServerQueuesAndStartPoints(userId: string, queues: any[], startPoints: any) {
  await fetch('/api/queues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, queues, startPoints })
  })
}

export default function Home() {
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [playlist, setPlaylist] = useState<Track[]>([])
  const [playlistName, setPlaylistName] = useState<string>('')
  const onTrackEndRef = useRef<(() => void) | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1)
  const [isShuffled, setIsShuffled] = useState(false)
  const [useStartTimes, setUseStartTimes] = useState<{ [key: string]: boolean }>({})
  const [showQueues, setShowQueues] = useState(true)
  const [showSpotifyLists, setShowSpotifyLists] = useState(true)

  // Spotify Player hook
  const {
    isPlaying,
    currentTrack,
    volume,
    currentTime,
    duration,
    isConnected,
    playTrack,
    pauseTrack,
    resumeTrack,
    setPlayerVolume,
    seekTo,
    playNext,
    playPrevious,
    isReady,
    // Nya för enhetshantering
    devices,
    activeDeviceId,
    fetchDevices
  } = useSpotifyPlayer(accessToken, () => {
    // Använd ref för att anropa handlePlayNext när den är redo
    console.log('onTrackEnd callback triggered, checking onTrackEndRef.current:', !!onTrackEndRef.current)
    if (onTrackEndRef.current) {
      console.log('Calling handlePlayNext via onTrackEndRef')
      onTrackEndRef.current()
    } else {
      console.log('Track ended, but handlePlayNext not ready yet')
    }
  })

  // Ladda access token från localStorage vid sidladdning
  useEffect(() => {
    const savedToken = localStorage.getItem('spotify_access_token')
    if (savedToken) {
      console.log('=== Loading saved access token from localStorage ===')
      // Kontrollera om token fortfarande är giltig genom att testa den
      checkTokenValidity(savedToken)
    }
  }, [])

  // Ladda useStartTimes när userId ändras
  useEffect(() => {
    if (userId) {
      try {
        const savedUseStartTimes = localStorage.getItem(`useStartTimes_${userId}`)
        if (savedUseStartTimes) {
          const useStartTimesData = JSON.parse(savedUseStartTimes)
          setUseStartTimes(useStartTimesData)
          console.log('Main component loaded use start times settings:', useStartTimesData)
        }
      } catch (error) {
        console.error('Fel vid laddning av useStartTimes:', error)
      }
    }
  }, [userId])

  // Ladda useStartTimes när playlist ändras
  useEffect(() => {
    if (userId && playlist.length > 0) {
      try {
        const savedUseStartTimes = localStorage.getItem(`useStartTimes_${userId}`)
        const savedStartTimes = localStorage.getItem(`trackStartTimes_${userId}`)
        
        if (savedStartTimes) {
          const startTimes = JSON.parse(savedStartTimes)
          const currentUseStartTimes = savedUseStartTimes ? JSON.parse(savedUseStartTimes) : {}
          
          // Sätt default useStartTimes för låtar med starttid som inte redan har en inställning
          const newUseStartTimes = { ...currentUseStartTimes }
          let hasChanges = false
          
          playlist.forEach(track => {
            if (startTimes[track.id] && !(track.id in currentUseStartTimes)) {
              newUseStartTimes[track.id] = true
              hasChanges = true
            }
          })
          
          if (hasChanges) {
            setUseStartTimes(newUseStartTimes)
            localStorage.setItem(`useStartTimes_${userId}`, JSON.stringify(newUseStartTimes))
            console.log('Updated useStartTimes for playlist:', newUseStartTimes)
          }
        }
      } catch (error) {
        console.error('Fel vid laddning av useStartTimes för playlist:', error)
      }
    }
  }, [playlist, userId])

  // Ladda sparade starttider för låtar i spellistan
  const loadSavedStartTimes = async (tracks: Track[]) => {
    if (!userId) return tracks

    try {
      // Försök hämta från servern först
      const serverData = await fetchServerQueuesAndStartPoints(userId)
      const serverStartPoints = serverData.startPoints || {}
      const serverUseStartTimes = serverData.useStartTimes || {}
      
      console.log('Loaded start points from server:', serverStartPoints)
      console.log('Loaded use start times from server:', serverUseStartTimes)
      
      // Uppdatera useStartTimes från servern
      if (Object.keys(serverUseStartTimes).length > 0) {
        setUseStartTimes(serverUseStartTimes)
        localStorage.setItem(`useStartTimes_${userId}`, JSON.stringify(serverUseStartTimes))
        console.log('Updated useStartTimes from server:', serverUseStartTimes)
      }
      
      // Fallback till localStorage om servern är tom
      if (Object.keys(serverStartPoints).length === 0) {
        const saved = localStorage.getItem(`trackStartTimes_${userId}`)
        if (saved) {
          const startTimes = JSON.parse(saved)
          
          // Sätt default useStartTimes för låtar med starttid
          const newUseStartTimes = { ...useStartTimes }
          let hasChanges = false
          
          tracks.forEach(track => {
            if (startTimes[track.id] && !(track.id in useStartTimes)) {
              newUseStartTimes[track.id] = true
              hasChanges = true
            }
          })
          
          if (hasChanges) {
            setUseStartTimes(newUseStartTimes)
            localStorage.setItem(`useStartTimes_${userId}`, JSON.stringify(newUseStartTimes))
            console.log('Set default useStartTimes for tracks with start times:', newUseStartTimes)
          }
          
          return tracks.map(track => ({
            ...track,
            startTime: startTimes[track.id] || undefined
          }))
        }
      } else {
        // Använd serverdata
        return tracks.map(track => ({
          ...track,
          startTime: serverStartPoints[track.id] || undefined
        }))
      }
    } catch (error) {
      console.error('Fel vid laddning av sparade starttider:', error)
      
      // Fallback till localStorage vid fel
      try {
        const saved = localStorage.getItem(`trackStartTimes_${userId}`)
        if (saved) {
          const startTimes = JSON.parse(saved)
          return tracks.map(track => ({
            ...track,
            startTime: startTimes[track.id] || undefined
          }))
        }
      } catch (localError) {
        console.error('Fel vid fallback till localStorage:', localError)
      }
    }
    return tracks
  }

  // Ladda sparad kö från localStorage när komponenten mountas
  useEffect(() => {
    if (userId) {
      const loadQueue = async () => {
        try {
          const savedQueue = localStorage.getItem(`spotify_queue_${userId}`)
          if (savedQueue) {
            const parsedQueue = JSON.parse(savedQueue)
            console.log('Loading saved queue for user:', userId, parsedQueue.length, 'tracks')
            
            // Ladda starttider för låtar i kön
            const tracksWithStartTimes = await loadSavedStartTimes(parsedQueue)
            setPlaylist(tracksWithStartTimes)
            console.log('Queue loaded with start times:', tracksWithStartTimes.map(t => ({ name: t.name, startTime: t.startTime })))
          }
        } catch (error) {
          console.error('Fel vid laddning av sparad kö:', error)
        }
      }
      loadQueue()
    }
  }, [userId])

  // Spara kö till localStorage när playlist ändras
  useEffect(() => {
    if (userId && playlist.length > 0) {
      try {
        localStorage.setItem(`spotify_queue_${userId}`, JSON.stringify(playlist))
        console.log('Saved queue for user:', userId, playlist.length, 'tracks')
      } catch (error) {
        console.error('Fel vid sparande av kö:', error)
      }
    } else if (userId && playlist.length === 0) {
      // Ta bort sparad kö om den är tom OCH användaren aktivt rensat den
      // (inte bara temporärt null under inloggning)
      const isLoggingIn = !accessToken // Om accessToken är null, är vi i inloggningsprocessen
      if (!isLoggingIn) {
        try {
          localStorage.removeItem(`spotify_queue_${userId}`)
          console.log('Removed empty queue for user:', userId)
        } catch (error) {
          console.error('Fel vid borttagning av sparad kö:', error)
        }
      } else {
        console.log('Skipping queue removal during login process')
      }
    }
  }, [playlist, userId, accessToken])

  // Hämta användar-ID från Spotify
  const fetchUserId = async (token: string) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUserId(userData.id)
        console.log('Fetched user ID:', userData.id)
        return userData.id
      } else {
        console.error('Failed to fetch user ID:', response.status)
        return null
      }
    } catch (error) {
      console.error('Error fetching user ID:', error)
      return null
    }
  }

  // Kontrollera om token är giltig
  const checkTokenValidity = async (token: string) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const userData = await response.json()
        setAccessToken(token)
        setUserId(userData.id)
        console.log('Token valid, user ID:', userData.id)
      } else {
        console.log('Saved token is invalid, clearing it')
        localStorage.removeItem('spotify_access_token')
        setAccessToken(null)
        setUserId(null)
      }
    } catch (error) {
      console.error('Error checking token validity:', error)
      localStorage.removeItem('spotify_access_token')
      setAccessToken(null)
      setUserId(null)
    }
  }

  // Spara access token till localStorage när den ändras
  useEffect(() => {
    if (accessToken) {
      console.log('=== Saving access token to localStorage ===')
      localStorage.setItem('spotify_access_token', accessToken)
    } else {
      console.log('=== Removing access token from localStorage ===')
      localStorage.removeItem('spotify_access_token')
    }
  }, [accessToken])

  const handleSearch = async (query: string) => {
    if (!accessToken) {
      console.log('No access token available for search')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.tracks || [])
      } else {
        console.error('Search failed:', response.status)
        // Om sökningen misslyckas på grund av ogiltig token, rensa den
        if (response.status === 401) {
          console.log('Token expired, clearing access token')
          setAccessToken(null)
        }
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearSearch = () => {
    setSearchResults([])
  }

  const handleAddToPlaylist = async (track: Track) => {
    // Ladda sparade starttider för den nya låten
    const tracksWithStartTime = await loadSavedStartTimes([track])
    const trackWithStartTime = tracksWithStartTime[0]
    
    setPlaylist(prev => {
      const newPlaylist = [...prev, trackWithStartTime]
      console.log('Added track to playlist:', track.name, 'with startTime:', trackWithStartTime.startTime)
      return newPlaylist
    })
  }

  const handleDragStart = (track: Track) => {
    // Hantera drag start om behövs
    console.log('Drag start:', track.name)
  }

  const handleRemoveFromPlaylist = (index: number) => {
    setPlaylist(prev => prev.filter((_, i) => i !== index))
  }

  const handlePlayTrack = async (track: Track, startTime?: number) => {
    if (!isReady) {
      console.log('Spotify Player not ready yet')
      return
    }

    const index = playlist.findIndex(t => t.id === track.id)
    
    if (index !== -1) {
      setCurrentTrackIndex(index)
    }

    // startTime kan vara i sekunder (från UI) eller millisekunder (från track.startTime)
    // Om startTime är mindre än 1000, antar vi att det är i sekunder
    let positionMs = 0
    if (startTime !== undefined) {
      // Om startTime skickas explicit, använd den
      positionMs = startTime < 1000 ? startTime * 1000 : startTime
    } else if (track.startTime && useStartTimes[track.id]) {
      // Annars använd track.startTime endast om useStartTimes är true för denna låt
      positionMs = track.startTime
    }
    // Om inget av ovanstående, använd positionMs = 0 (spela från början)
    
    console.log('handlePlayTrack:', {
      trackName: track.name,
      startTime,
      trackStartTime: track.startTime,
      positionMs,
      isSeconds: startTime && startTime < 1000
    })
    
    await playTrack(track, positionMs)
  }

  const handlePlayNext = async () => {
    console.log('handlePlayNext called:', {
      playlistLength: playlist.length,
      currentTrackIndex,
      isShuffled
    })
    
    if (playlist.length === 0 || currentTrackIndex === -1) {
      console.log('handlePlayNext: playlist empty or no current track, returning')
      return
    }

    let nextIndex: number
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * playlist.length)
    } else {
      nextIndex = (currentTrackIndex + 1) % playlist.length
    }

    const nextTrack = playlist[nextIndex]
    setCurrentTrackIndex(nextIndex)
    
    // Använd useStartTimes-logiken för att avgöra om starttid ska användas
    const shouldUseStartTime = useStartTimes[nextTrack.id] && nextTrack.startTime
    const startTimeMs = shouldUseStartTime && nextTrack.startTime ? nextTrack.startTime : undefined
    
    console.log('handlePlayNext:', { 
      trackName: nextTrack.name, 
      trackId: nextTrack.id,
      startTime: nextTrack.startTime, 
      shouldUseStartTime,
      useStartTime: useStartTimes[nextTrack.id],
      allUseStartTimes: useStartTimes,
      playlistLength: playlist.length,
      currentTrackIndex
    })
    
    // Skicka startTimeMs direkt till playTrack (redan i millisekunder)
    if (startTimeMs) {
      await playTrack(nextTrack, startTimeMs)
    } else {
      await playTrack(nextTrack)
    }
  }

  // Sätt ref för onTrackEnd callback
  useEffect(() => {
    console.log('Setting onTrackEndRef.current to handlePlayNext:', {
      playlistLength: playlist.length,
      currentTrackIndex,
      useStartTimesKeys: Object.keys(useStartTimes)
    })
    onTrackEndRef.current = handlePlayNext
  }, [playlist, currentTrackIndex, useStartTimes])

  const handlePlayPrevious = async () => {
    if (playlist.length === 0 || currentTrackIndex === -1) {
      return
    }

    let prevIndex: number
    if (isShuffled) {
      prevIndex = Math.floor(Math.random() * playlist.length)
    } else {
      prevIndex = currentTrackIndex === 0 ? playlist.length - 1 : currentTrackIndex - 1
    }

    const prevTrack = playlist[prevIndex]
    setCurrentTrackIndex(prevIndex)
    
    // Använd useStartTimes-logiken för att avgöra om starttid ska användas
    const shouldUseStartTime = useStartTimes[prevTrack.id] && prevTrack.startTime
    const startTimeMs = shouldUseStartTime && prevTrack.startTime ? prevTrack.startTime : undefined
    
    console.log('handlePlayPrevious:', { 
      trackName: prevTrack.name, 
      trackId: prevTrack.id,
      startTime: prevTrack.startTime, 
      shouldUseStartTime,
      useStartTime: useStartTimes[prevTrack.id],
      allUseStartTimes: useStartTimes,
      playlistLength: playlist.length,
      currentTrackIndex
    })
    
    await handlePlayTrack(prevTrack, startTimeMs)
  }

  const handleTogglePlay = async () => {
    if (!isReady) return

    if (isPlaying) {
      await pauseTrack()
    } else {
      await resumeTrack()
    }
  }

  const handleVolumeChange = async (newVolume: number) => {
    await setPlayerVolume(newVolume)
  }

  const handleSeek = async (positionMs: number) => {
    console.log('Seeking to position:', positionMs, 'ms')
    await seekTo(positionMs)
  }

  const handleShuffle = () => {
    setIsShuffled(!isShuffled)
  }

  // Lägg till alla låtar i kön
  const handleAddAllToQueue = async (tracks: Track[]) => {
    // Ladda sparade starttider för alla tracks
    const tracksWithStartTimes = await loadSavedStartTimes(tracks)
    setPlaylist(prev => {
      return [...prev, ...tracksWithStartTimes]
    })
  }

  const handleAuthSuccess = async (token: string) => {
    setAccessToken(token)
    await fetchUserId(token)
  }

  // Rensa kö när användaren loggar ut
  const handleLogout = () => {
    setAccessToken(null)
    setUserId(null)
    setPlaylist([])
    setSearchResults([])
    setCurrentTrackIndex(-1)
    setIsShuffled(false)
    
    // Rensa endast access token, behåll spellistan och starttider
    console.log('Logged out, cleared access token but kept playlist data')
  }

  const handleReorderTracks = (newPlaylist: Track[]) => {
    console.log('handleReorderTracks called:', {
      oldLength: playlist.length,
      newLength: newPlaylist.length,
      oldPlaylist: playlist.map(t => t.name),
      newPlaylist: newPlaylist.map(t => t.name)
    })
    
    setPlaylist(newPlaylist)
    
    // Uppdatera currentTrackIndex om den nuvarande låten flyttades
    if (currentTrack && currentTrackIndex !== -1) {
      const newIndex = newPlaylist.findIndex(track => track.id === currentTrack.id)
      if (newIndex !== -1 && newIndex !== currentTrackIndex) {
        console.log('Updating currentTrackIndex:', { from: currentTrackIndex, to: newIndex })
        setCurrentTrackIndex(newIndex)
      }
    }
  }

  const handleClearQueue = () => {
    setPlaylist([])
    setCurrentTrackIndex(-1)
    // Behåll useStartTimes och starttider - de kan användas för framtida låtar
    console.log('Kö rensad, starttid-inställningar behållna')
  }

  // --- Migrering och synk vid inloggning ---
  useEffect(() => {
    if (!userId) return
    (async () => {
      // 1. Hämta från servern
      const serverData = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
        .then(res => res.json())
      let localQueues = []
      let localStartPoints = {}
      let localUseStartTimes = {}
      try {
        localQueues = JSON.parse(localStorage.getItem(`spotify_queues_${userId}`) || '[]')
      } catch {}
      try {
        localStartPoints = JSON.parse(localStorage.getItem(`trackStartTimes_${userId}`) || '{}')
      } catch {}
      try {
        localUseStartTimes = JSON.parse(localStorage.getItem(`useStartTimes_${userId}`) || '{}')
      } catch {}
      console.log('DEBUG: localQueues', localQueues)
      console.log('DEBUG: localStartPoints', localStartPoints)
      console.log('DEBUG: localUseStartTimes', localUseStartTimes)
      console.log('DEBUG: serverData', serverData)
      // NYTT: Om localQueues är tom, kolla även efter spotify_queue_${userId} (en array av tracks)
      if ((!localQueues || localQueues.length === 0) && localStorage.getItem(`spotify_queue_${userId}`)) {
        try {
          const singleQueue = JSON.parse(localStorage.getItem(`spotify_queue_${userId}`) || '[]')
          if (Array.isArray(singleQueue) && singleQueue.length > 0) {
            localQueues = [{
              id: `migrated_${Date.now()}`,
              userId,
              name: 'Migrerad kö',
              tracks: singleQueue,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }]
            console.log('Migrerar från spotify_queue_${userId} (array av tracks):', localQueues)
          }
        } catch (e) {
          console.error('Fel vid migrering från spotify_queue:', e)
        }
      }
      // 2. Om servern saknar data men localStorage har, migrera
      let queuesToMigrate = localQueues
      if (Array.isArray(localQueues) && localQueues.length > 0 && !localQueues[0].tracks) {
        queuesToMigrate = [{
          id: `migrated_${Date.now()}`,
          userId,
          name: 'Migrerad kö',
          tracks: localQueues,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
        console.log('Migrerar tracks-array som kö-objekt:', queuesToMigrate)
      } else {
        console.log('Migrerar kö-objekt:', queuesToMigrate)
      }
      const needsMigration = (serverData.queues?.length === 0 && queuesToMigrate.length > 0) ||
                            (Object.keys(serverData.startPoints || {}).length === 0 && Object.keys(localStartPoints).length > 0) ||
                            (Object.keys(serverData.useStartTimes || {}).length === 0 && Object.keys(localUseStartTimes).length > 0)
      console.log('DEBUG: needsMigration', needsMigration)
      if (needsMigration) {
        const resp = await fetch('/api/queues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, queues: queuesToMigrate, startPoints: localStartPoints, useStartTimes: localUseStartTimes })
        })
        const respJson = await resp.json()
        console.log('Svar från migrerings-POST:', resp.status, respJson)
        // Rensa localStorage
        localStorage.removeItem(`spotify_queues_${userId}`)
        localStorage.removeItem(`trackStartTimes_${userId}`)
        localStorage.removeItem(`useStartTimes_${userId}`)
        alert('Dina köer, startpunkter och starttidsval har nu flyttats till servern och är tillgängliga på alla enheter!')
        // Hämta igen från servern efter migrering
        const newServerData = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`).then(res => res.json())
        if (newServerData.queues && newServerData.queues.length > 0) {
          setPlaylist(newServerData.queues[0].tracks || [])
        }
        if (newServerData.startPoints) {
          setUseStartTimes(newServerData.useStartTimes || {})
        }
      } else {
        // Ingen migrering, ladda från servern
        if (serverData.queues && serverData.queues.length > 0) {
          setPlaylist(serverData.queues[0].tracks || [])
        }
        if (serverData.useStartTimes) {
          setUseStartTimes(serverData.useStartTimes)
        }
      }
    })()
  }, [userId])

  // Spara useStartTimes till servern och localStorage vid ändring
  useEffect(() => {
    if (!userId) return
    localStorage.setItem(`useStartTimes_${userId}`, JSON.stringify(useStartTimes))
    // Hämta aktuell data från servern först
    const syncUseStartTimes = async () => {
      const serverData = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`).then(res => res.json())
      const queues = serverData.queues || []
      const startPoints = serverData.startPoints || {}
      // Skicka tillbaka hela objektet, men med uppdaterad useStartTimes
      await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, queues, startPoints, useStartTimes })
      })
    }
    syncUseStartTimes()
  }, [useStartTimes, userId])

  return (
    <div className="min-h-screen bg-spotify-black">
      {!accessToken ? (
        <div className="flex items-center justify-center min-h-screen">
          <SpotifyAuth onAuthSuccess={handleAuthSuccess} />
        </div>
      ) : (
        <div className="flex h-screen">
          {/* Vänster panel - Sökning och spellistor */}
          <div className="w-1/2 bg-spotify-dark p-6 overflow-y-auto">
            <div className="mb-6">
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 mb-4"
              >
                Logga ut
              </button>
            </div>
            
            {/* Sökning */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Sök låtar</h2>
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
              {searchResults.length > 0 && (
                <>
                  <div className="mt-2 mb-4">
                    <button
                      onClick={handleClearSearch}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                    >
                      Rensa sökresultat
                    </button>
                  </div>
                  <TrackList
                    tracks={searchResults}
                    onAddToPlaylist={handleAddToPlaylist}
                    onPlayTrack={handlePlayTrack}
                    title="Sökresultat"
                  />
                </>
              )}
            </div>
            {/* Sparade köer */}
            <div className="mb-6">
              <button
                onClick={() => setShowQueues(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 mb-2"
              >
                <span>Sparade köer (lokalt)</span>
                <span>{showQueues ? '▲' : '▼'}</span>
              </button>
              {showQueues && (
                <QueueSaver
                  playlist={playlist}
                  accessToken={accessToken}
                  userId={userId}
                  onLoadQueue={async (tracks, name) => {
                    // Ladda sparade starttider för alla låtar i kön
                    const tracksWithStartTimes = await loadSavedStartTimes(tracks)
                    setPlaylist(tracksWithStartTimes)
                    setPlaylistName(name)
                    console.log('Loaded queue:', { name, trackCount: tracks.length, tracksWithStartTimes: tracksWithStartTimes.map(t => ({ name: t.name, startTime: t.startTime })) })
                  }}
                />
              )}
              <div className="text-xs text-gray-400 mt-1">Köer sparas endast i denna webbläsare, inte på Spotify-kontot.</div>
            </div>
            {/* Spotify-spellistor */}
            <div className="mb-6">
              <button
                onClick={() => setShowSpotifyLists(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 mb-2"
              >
                <span>Spotify-spellistor</span>
                <span>{showSpotifyLists ? '▲' : '▼'}</span>
              </button>
              {showSpotifyLists && (
                <SpotifyPlaylistLoader
                  accessToken={accessToken}
                  onAddToPlaylist={handleAddToPlaylist}
                  onPlayTrack={handlePlayTrack}
                  onAddAllToQueue={handleAddAllToQueue}
                />
              )}
            </div>
            {/* Resten av vänsterpanelen ... */}


          </div>

          {/* Höger panel - Kö och nuvarande låt */}
          <div className="w-1/2 bg-spotify-black p-6">
            {/* Ta bort enhetsval och status här */}
            <QueueManager
              playlist={playlist}
              onRemoveTrack={handleRemoveFromPlaylist}
              onPlayTrack={handlePlayTrack}
              onPlayNext={handlePlayNext}
              onPlayPrevious={handlePlayPrevious}
              onTogglePlay={handleTogglePlay}
              onVolumeChange={handleVolumeChange}
              onSeek={handleSeek}
              onShuffle={handleShuffle}
              isPlaying={isPlaying}
              currentTrack={currentTrack}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              isShuffled={isShuffled}
              currentTrackIndex={currentTrackIndex}
              onReorderTracks={handleReorderTracks}
              onClearQueue={handleClearQueue}
              accessToken={accessToken}
              userId={userId}
              useStartTimes={useStartTimes}
              setUseStartTimes={setUseStartTimes}
            />
          </div>
        </div>
      )}
    </div>
  )
} 