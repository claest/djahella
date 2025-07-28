'use client'

import { useState, useEffect, useRef } from 'react'
import { Track } from '@/types/spotify'
import { useSpotifyPlayer } from '@/hooks/useSpotifyPlayer'
import SearchBar from '@/components/SearchBar'
import TrackList from '@/components/TrackList'
import QueueManager from '@/components/QueueManager'
import QueueSaver from '@/components/QueueSaver'
import SpotifyPlaylistLoader from '@/components/SpotifyPlaylistLoader'
import SpotifyAuth from '@/components/SpotifyAuth'
import SpotifyPlayer from '@/components/SpotifyPlayer'

// --- Server-synk och migrering ---
async function fetchServerQueuesAndStartPoints(userId: string) {
  const res = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return { queues: [], startPoints: {}, useStartTimes: {}, fadeInSettings: {} }
  return await res.json()
}

async function saveServerQueuesAndStartPoints(userId: string, queues: any[]) {
  // Hämta aktuella startPoints, useStartTimes och fadeInSettings från servern
  const serverData = await fetchServerQueuesAndStartPoints(userId)
  const startPoints = serverData.startPoints || {}
  const useStartTimes = serverData.useStartTimes || {}
  const fadeInSettings = serverData.fadeInSettings || {}
  await fetch('/api/queues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, queues, startPoints, useStartTimes, fadeInSettings })
  })
}

export default function Home() {
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [playlist, setPlaylist] = useState<Track[]>([])
  const [playlistName, setPlaylistName] = useState<string>('')
  const onTrackEndRef = useRef<(() => void) | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1)
  const [isShuffled, setIsShuffled] = useState(false)
  const [useStartTimes, setUseStartTimes] = useState<{ [key: string]: boolean }>({})
  const [fadeInSettings, setFadeInSettings] = useState<{ [key: string]: boolean }>({})
  const [showQueues, setShowQueues] = useState(true)
  const [showSpotifyLists, setShowSpotifyLists] = useState(true)
  const [showQueue, setShowQueue] = useState(true)
  const [startPoints, setStartPoints] = useState<{ [key: string]: number }>({})
  const [showSearch, setShowSearch] = useState(true)
  const [activeTab, setActiveTab] = useState<'search' | 'queue' | 'saved' | 'playlists'>('search')
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false)
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false)

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

  // Retry-mekanism för när spelaren blir redo
  const [pendingPlayRequest, setPendingPlayRequest] = useState<{
    track: Track;
    startTime?: number;
  } | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 5

  // När spelaren blir redo, försök spela pending request
  useEffect(() => {
    if (isReady && pendingPlayRequest) {
      console.log('Player is now ready, attempting to play pending request')
      const { track, startTime } = pendingPlayRequest
      setPendingPlayRequest(null)
      setRetryCount(0) // Återställ retry-räknare
      
      // Försök spela med en längre fördröjning för att säkerställa att spelaren är helt redo
      setTimeout(() => {
        handlePlayTrack(track, startTime)
      }, 1000) // Öka från 500ms till 1000ms
    }
  }, [isReady, pendingPlayRequest])

  // Retry-mekanism för när spelaren fortfarande inte är redo
  useEffect(() => {
    if (pendingPlayRequest && !isReady && retryCount < maxRetries) {
      const retryTimer = setTimeout(() => {
        console.log(`Retry attempt ${retryCount + 1}/${maxRetries} for pending play request`)
        setRetryCount(prev => prev + 1)
        
        // Om spelaren fortfarande inte är redo efter flera försök, visa meddelande
        if (retryCount + 1 >= maxRetries) {
          console.log('Max retries reached, clearing pending request')
          setPendingPlayRequest(null)
          setRetryCount(0)
          alert('Spotify-spelaren kunde inte startas. Kontrollera att Spotify-appen är öppen och försök igen.')
        }
      }, 2000) // Vänta 2 sekunder mellan försök
      
      return () => clearTimeout(retryTimer)
    }
  }, [pendingPlayRequest, isReady, retryCount, maxRetries])

  // Ladda tokens från localStorage vid sidladdning
  useEffect(() => {
    const savedToken = localStorage.getItem('spotify_access_token')
    const savedRefreshToken = localStorage.getItem('spotify_refresh_token')
    const savedExpiry = localStorage.getItem('spotify_token_expiry')
    
    if (savedToken && savedRefreshToken) {
      console.log('=== Loading saved tokens from localStorage ===')
      const expiryTime = savedExpiry ? parseInt(savedExpiry) : null
      
      // Kontrollera om token fortfarande är giltig
      if (expiryTime && Date.now() < expiryTime) {
        console.log('Token is still valid, using saved token')
        setAccessToken(savedToken)
        setRefreshToken(savedRefreshToken)
        setTokenExpiry(expiryTime)
        checkTokenValidity(savedToken)
      } else if (savedRefreshToken) {
        console.log('Token expired, attempting refresh')
        refreshAccessToken(savedRefreshToken)
      } else {
        console.log('No refresh token available, clearing expired tokens')
        handleLogout()
      }
    } else {
      console.log('No saved tokens found')
      // Rensa eventuella gamla tokens som kan finnas
      localStorage.removeItem('spotify_access_token')
      localStorage.removeItem('spotify_refresh_token')
      localStorage.removeItem('spotify_token_expiry')
    }
  }, [])

  // Automatisk token-förnyelse innan den går ut
  useEffect(() => {
    if (!refreshToken || !tokenExpiry) return

    const timeUntilExpiry = tokenExpiry - Date.now()
    const refreshTime = Math.max(timeUntilExpiry - 60000, 0) // Förnya 1 minut innan utgång

    console.log(`Token expires in ${Math.round(timeUntilExpiry / 1000)}s, will refresh in ${Math.round(refreshTime / 1000)}s`)

    const refreshTimer = setTimeout(() => {
      console.log('Auto-refreshing token...')
      refreshAccessToken(refreshToken)
    }, refreshTime)

    return () => clearTimeout(refreshTimer)
  }, [refreshToken, tokenExpiry])

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

  // Funktion för att logga ut användaren
  const handleLogout = () => {
    console.log('Logging out user')
    
    // Rensa alla tokens från localStorage
    localStorage.removeItem('spotify_access_token')
    localStorage.removeItem('spotify_refresh_token')
    localStorage.removeItem('spotify_token_expiry')
    
    // Rensa alla state-variabler
    setAccessToken(null)
    setRefreshToken(null)
    setTokenExpiry(null)
    setUserId(null)
    setCurrentTrackIndex(-1)
    
    // Rensa kö och sökresultat
    setPlaylist([])
    setSearchResults([])
    setPlaylistName('')
    
    // Rensa alla inställningar
    setStartPoints({})
    setUseStartTimes({})
    setFadeInSettings({})
    
    console.log('User logged out successfully')
  }

  // Funktion för att förnya access token
  const refreshAccessToken = async (refreshToken: string) => {
    try {
      console.log('Refreshing token...')
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Token refresh failed:', errorData)
        
        // Om refresh token är ogiltig, rensa alla tokens
        if (errorData.error === 'invalid_grant') {
          console.log('Invalid refresh token, clearing all tokens')
          handleLogout()
          alert('Din Spotify-session har gått ut. Logga in igen för att fortsätta.')
          return
        }
        
        throw new Error(errorData.error_description || 'Kunde inte förnya token')
      }

      const data = await response.json()
      const newExpiry = Date.now() + (data.expires_in * 1000)
      
      // Spara nya tokens
      localStorage.setItem('spotify_access_token', data.access_token)
      localStorage.setItem('spotify_refresh_token', data.refresh_token)
      localStorage.setItem('spotify_token_expiry', newExpiry.toString())
      
      setAccessToken(data.access_token)
      setRefreshToken(data.refresh_token)
      setTokenExpiry(newExpiry)
      
      console.log('Token refreshed successfully')
    } catch (error) {
      console.error('Token refresh error:', error)
      
      // Rensa alla tokens vid fel
      handleLogout()
      alert('Kunde inte förnya din Spotify-session. Logga in igen för att fortsätta.')
    }
  }

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
      const serverFadeInSettings = serverData.fadeInSettings || {}
      setStartPoints(serverStartPoints) // Spara i state
      setFadeInSettings(serverFadeInSettings) // Spara fade-in settings i state

      // Sätt default useStartTimes till true för alla låtar med starttid om det saknas
      const newUseStartTimes = { ...serverUseStartTimes }
      let hasChanges = false
      tracks.forEach(track => {
        if (serverStartPoints[track.id] && !(track.id in newUseStartTimes)) {
          newUseStartTimes[track.id] = true
          hasChanges = true
        }
      })
      if (hasChanges) {
        setUseStartTimes(newUseStartTimes)
        // Spara till servern direkt
        await fetch('/api/queues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            queues: serverData.queues || [],
            startPoints: serverStartPoints,
            useStartTimes: newUseStartTimes
          })
        })
      }
      
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

  // Ladda sparad kö från databasen när komponenten mountas
  useEffect(() => {
    if (userId) {
      const loadQueue = async () => {
        try {
          // Försök hämta från databasen först
          const serverData = await fetchServerQueuesAndStartPoints(userId)
          if (serverData.queues && serverData.queues.length > 0) {
            // Ta den senaste kön
            const latestQueue = serverData.queues[serverData.queues.length - 1]
            console.log('Loading queue from database for user:', userId, latestQueue.tracks.length, 'tracks')
            
            // Ladda starttider för låtar i kön
            const tracksWithStartTimes = await loadSavedStartTimes(latestQueue.tracks)
            setPlaylist(tracksWithStartTimes)
            setPlaylistName(latestQueue.name)
            console.log('Queue loaded from database with start times:', tracksWithStartTimes.map(t => ({ name: t.name, startTime: t.startTime })))
          } else {
            // Fallback till localStorage om databasen är tom
            const savedQueue = localStorage.getItem(`spotify_queue_${userId}`)
            if (savedQueue) {
              const parsedQueue = JSON.parse(savedQueue)
              console.log('Loading saved queue from localStorage for user:', userId, parsedQueue.length, 'tracks')
              
              // Ladda starttider för låtar i kön
              const tracksWithStartTimes = await loadSavedStartTimes(parsedQueue)
              setPlaylist(tracksWithStartTimes)
              console.log('Queue loaded from localStorage with start times:', tracksWithStartTimes.map(t => ({ name: t.name, startTime: t.startTime })))
            }
          }
        } catch (error) {
          console.error('Fel vid laddning av sparad kö:', error)
          
          // Fallback till localStorage vid fel
          try {
            const savedQueue = localStorage.getItem(`spotify_queue_${userId}`)
            if (savedQueue) {
              const parsedQueue = JSON.parse(savedQueue)
              console.log('Fallback: Loading saved queue from localStorage for user:', userId, parsedQueue.length, 'tracks')
              
              // Ladda starttider för låtar i kön
              const tracksWithStartTimes = await loadSavedStartTimes(parsedQueue)
              setPlaylist(tracksWithStartTimes)
              console.log('Fallback: Queue loaded from localStorage with start times:', tracksWithStartTimes.map(t => ({ name: t.name, startTime: t.startTime })))
            }
          } catch (localError) {
            console.error('Fel vid fallback till localStorage:', localError)
          }
        }
      }
      loadQueue()
    }
  }, [userId])

  // Spara kö till databasen när playlist ändras (ersätter localStorage-sparning)
  useEffect(() => {
    if (userId && playlist.length > 0) {
      // Använd setTimeout för att undvika för många API-anrop
      const timeoutId = setTimeout(async () => {
        try {
          await saveServerQueuesAndStartPoints(userId, [{
            id: `current_queue_${Date.now()}`,
            userId,
            name: playlistName || 'Aktiv kö',
            tracks: playlist,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }])
          console.log('Playlist auto-saved to database:', playlist.length, 'tracks')
        } catch (error) {
          console.error('Fel vid auto-sparande av kö till databasen:', error)
        }
      }, 1000) // Vänta 1 sekund innan sparande
      
      return () => clearTimeout(timeoutId)
    }
  }, [playlist, userId, playlistName])

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
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!response.ok) {
        console.log('Token validation failed, status:', response.status)
        
        if (response.status === 401) {
          // Token är ogiltig, försök förnya
          const savedRefreshToken = localStorage.getItem('spotify_refresh_token')
          if (savedRefreshToken) {
            console.log('Attempting token refresh due to 401')
            await refreshAccessToken(savedRefreshToken)
          } else {
            console.log('No refresh token available, logging out')
            handleLogout()
            alert('Din Spotify-session har gått ut. Logga in igen för att fortsätta.')
          }
        } else {
          console.error('Unexpected error during token validation:', response.status)
          handleLogout()
          alert('Ett oväntat fel uppstod. Logga in igen för att fortsätta.')
        }
        return false
      }
      
      const userData = await response.json()
      setUserId(userData.id)
      console.log('Token is valid, user ID:', userData.id)
      return true
    } catch (error) {
      console.error('Error checking token validity:', error)
      handleLogout()
      alert('Kunde inte verifiera din Spotify-session. Logga in igen för att fortsätta.')
      return false
    }
  }



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
        // Om sökningen misslyckas på grund av ogiltig token, försök förnya
        if (response.status === 401) {
          console.log('Token expired during search, attempting refresh')
          const savedRefreshToken = localStorage.getItem('spotify_refresh_token')
          if (savedRefreshToken) {
            await refreshAccessToken(savedRefreshToken)
            // Försök söka igen med den nya token
            if (accessToken) {
              const retryResponse = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              })
              if (retryResponse.ok) {
                const retryData = await retryResponse.json()
                setSearchResults(retryData.tracks || [])
              }
            }
          } else {
            console.log('No refresh token available, clearing access token')
            setAccessToken(null)
          }
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
      
      // Spara till databasen
      if (userId && newPlaylist.length > 0) {
        setTimeout(async () => {
          try {
            await saveServerQueuesAndStartPoints(userId, [{
              id: `current_queue_${Date.now()}`,
              userId,
              name: playlistName || 'Aktiv kö',
              tracks: newPlaylist,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }])
            console.log('Updated playlist saved to database after adding track')
          } catch (error) {
            console.error('Fel vid sparande av uppdaterad spellista till databasen:', error)
          }
        }, 100)
      }
      
      return newPlaylist
    })
  }

  const handleDragStart = (track: Track) => {
    // Hantera drag start om behövs
    console.log('Drag start:', track.name)
  }

  const handleRemoveFromPlaylist = (index: number) => {
    setPlaylist(prev => {
      const newPlaylist = prev.filter((_, i) => i !== index)
      
      // Spara till databasen
      if (userId && newPlaylist.length > 0) {
        setTimeout(async () => {
          try {
            await saveServerQueuesAndStartPoints(userId, [{
              id: `current_queue_${Date.now()}`,
              userId,
              name: playlistName || 'Aktiv kö',
              tracks: newPlaylist,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }])
            console.log('Updated playlist saved to database after removing track')
          } catch (error) {
            console.error('Fel vid sparande av uppdaterad spellista till databasen:', error)
          }
        }, 100)
      }
      
      return newPlaylist
    })
  }

  const handlePlayTrack = async (track: Track, startTime?: number) => {
    if (!isReady || !accessToken) {
      const message = !isReady 
        ? 'Spotify-spelaren är inte redo än. Vänta lite och försök igen. Om problemet kvarstår, kontrollera att Spotify-appen är öppen.'
        : 'Ingen Spotify-åtkomst. Logga in igen för att fortsätta.'
      
      // Spara request för senare om spelaren inte är redo
      if (!isReady) {
        console.log('Player not ready, saving request for later')
        setPendingPlayRequest({ track, startTime })
        setRetryCount(0) // Återställ retry-räknare
      }
      
      alert(message)
      return
    }

    try {
      console.log('=== handlePlayTrack called ===')
      console.log('Track:', track.name)
      console.log('Start time:', startTime)
      console.log('Is ready:', isReady)
      console.log('Access token exists:', !!accessToken)
      
      // Sätt currentTrackIndex för denna låt
      const trackIndex = playlist.findIndex(t => t.id === track.id)
      if (trackIndex !== -1) {
        setCurrentTrackIndex(trackIndex)
        console.log('Set currentTrackIndex to:', trackIndex)
      }
      
      // Kontrollera fade-in inställning för denna låt
      const shouldFadeIn = fadeInSettings[track.id] || false
      console.log('Fade-in setting for track:', shouldFadeIn)
      
      await playTrack(track, startTime, shouldFadeIn)
      console.log('Track play successful')
    } catch (error) {
      console.error('Fel vid uppspelning av låt:', error)
      
      // Om det är ett 401-fel, försök förnya token och spela igen
      if (error instanceof Error && error.message.includes('401')) {
        console.log('401 error detected, attempting token refresh')
        try {
          if (refreshToken) {
            await refreshAccessToken(refreshToken)
            // Försök spela igen efter token-förnyelse
            const shouldFadeIn = fadeInSettings[track.id] || false
            await playTrack(track, startTime, shouldFadeIn)
            console.log('Track play successful after token refresh')
          } else {
            alert('Din Spotify-session har gått ut. Logga in igen för att fortsätta.')
            handleLogout()
          }
        } catch (refreshError) {
          console.error('Fel vid token-förnyelse:', refreshError)
          alert('Kunde inte förnya din Spotify-session. Logga in igen för att fortsätta.')
          handleLogout()
        }
      } else {
        alert(`Kunde inte spela låten: ${error instanceof Error ? error.message : 'Okänt fel'}`)
      }
    }
  }

  const handlePlayNext = async () => {
    console.log('handlePlayNext called:', {
      playlistLength: playlist.length,
      currentTrackIndex,
      isShuffled
    })
    
    if (playlist.length === 0) {
      console.log('handlePlayNext: playlist empty, returning')
      return
    }

    let nextIndex: number
    if (currentTrackIndex === -1) {
      // Om ingen låt spelas just nu, börja med första låten
      nextIndex = 0
      console.log('No current track, starting with first track')
    } else if (isShuffled) {
      nextIndex = Math.floor(Math.random() * playlist.length)
    } else {
      nextIndex = (currentTrackIndex + 1) % playlist.length
    }

    const nextTrack = playlist[nextIndex]
    setCurrentTrackIndex(nextIndex)
    
    // Använd useStartTimes-logiken för att avgöra om starttid ska användas
    const shouldUseStartTime = useStartTimes[nextTrack.id] && nextTrack.startTime
    const startTimeMs = shouldUseStartTime && nextTrack.startTime ? nextTrack.startTime : undefined
    
    // Kontrollera fade-in inställning för nästa låt
    const shouldFadeIn = fadeInSettings[nextTrack.id] || false
    
    console.log('handlePlayNext:', { 
      trackName: nextTrack.name, 
      trackId: nextTrack.id,
      startTime: nextTrack.startTime, 
      shouldUseStartTime,
      useStartTime: useStartTimes[nextTrack.id],
      allUseStartTimes: useStartTimes,
      fadeIn: shouldFadeIn,
      playlistLength: playlist.length,
      currentTrackIndex: nextIndex
    })
    
    // Skicka startTimeMs och fadeIn direkt till playTrack
    await handlePlayTrack(nextTrack, startTimeMs)
  }

  // Sätt ref för onTrackEnd callback
  useEffect(() => {
    console.log('Setting onTrackEndRef.current to handlePlayNext:', {
      playlistLength: playlist.length,
      currentTrackIndex,
      useStartTimesKeys: Object.keys(useStartTimes),
      fadeInSettingsKeys: Object.keys(fadeInSettings)
    })
    onTrackEndRef.current = handlePlayNext
  }, [playlist, currentTrackIndex, useStartTimes, fadeInSettings])

  const handlePlayPrevious = async () => {
    if (playlist.length === 0) {
      return
    }

    let prevIndex: number
    if (currentTrackIndex === -1) {
      // Om ingen låt spelas just nu, börja med sista låten
      prevIndex = playlist.length - 1
      console.log('No current track, starting with last track')
    } else if (isShuffled) {
      prevIndex = Math.floor(Math.random() * playlist.length)
    } else {
      prevIndex = currentTrackIndex === 0 ? playlist.length - 1 : currentTrackIndex - 1
    }

    const prevTrack = playlist[prevIndex]
    setCurrentTrackIndex(prevIndex)
    
    // Använd useStartTimes-logiken för att avgöra om starttid ska användas
    const shouldUseStartTime = useStartTimes[prevTrack.id] && prevTrack.startTime
    const startTimeMs = shouldUseStartTime && prevTrack.startTime ? prevTrack.startTime : undefined
    
    // Kontrollera fade-in inställning för föregående låt
    const shouldFadeIn = fadeInSettings[prevTrack.id] || false
    
    console.log('handlePlayPrevious:', { 
      trackName: prevTrack.name, 
      trackId: prevTrack.id,
      startTime: prevTrack.startTime, 
      shouldUseStartTime,
      useStartTime: useStartTimes[prevTrack.id],
      allUseStartTimes: useStartTimes,
      fadeIn: shouldFadeIn,
      playlistLength: playlist.length,
      currentTrackIndex: prevIndex
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
      const newPlaylist = [...prev, ...tracksWithStartTimes]
      
      // Spara till databasen
      if (userId && newPlaylist.length > 0) {
        setTimeout(async () => {
          try {
            await saveServerQueuesAndStartPoints(userId, [{
              id: `current_queue_${Date.now()}`,
              userId,
              name: playlistName || 'Aktiv kö',
              tracks: newPlaylist,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }])
            console.log('Updated playlist saved to database after adding all tracks')
          } catch (error) {
            console.error('Fel vid sparande av uppdaterad spellista till databasen:', error)
          }
        }, 100)
      }
      
      return newPlaylist
    })
  }

  const handleAuthSuccess = async (token: string, refreshToken: string, expiresIn: number) => {
    const expiryTime = Date.now() + (expiresIn * 1000)
    
    // Spara tokens till localStorage
    localStorage.setItem('spotify_access_token', token)
    localStorage.setItem('spotify_refresh_token', refreshToken)
    localStorage.setItem('spotify_token_expiry', expiryTime.toString())
    
    setAccessToken(token)
    setRefreshToken(refreshToken)
    setTokenExpiry(expiryTime)
    
    await fetchUserId(token)
  }



  const handleReorderTracks = async (newPlaylist: Track[]) => {
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
    
    // Spara till databasen
    if (userId && newPlaylist.length > 0) {
      try {
        await saveServerQueuesAndStartPoints(userId, [{
          id: `current_queue_${Date.now()}`,
          userId,
          name: playlistName || 'Aktiv kö',
          tracks: newPlaylist,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }])
        console.log('Reordered playlist saved to database')
      } catch (error) {
        console.error('Fel vid sparande av omordnad spellista till databasen:', error)
      }
    }
  }

  const handleClearQueue = () => {
    setPlaylist([])
    setCurrentTrackIndex(-1)
    setPlaylistName('')
  }

  // Växla fade-in för en låt
  const handleToggleFadeIn = async (trackId: string) => {
    const newFadeInSettings = { ...fadeInSettings }
    newFadeInSettings[trackId] = !newFadeInSettings[trackId]
    setFadeInSettings(newFadeInSettings)
    
    // Spara till servern
    if (userId) {
      try {
        const serverData = await fetchServerQueuesAndStartPoints(userId)
        await fetch('/api/queues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            queues: serverData.queues || [],
            startPoints: serverData.startPoints || {},
            useStartTimes: serverData.useStartTimes || {},
            fadeInSettings: newFadeInSettings
          })
        })
        console.log('Fade-in settings saved:', newFadeInSettings)
      } catch (error) {
        console.error('Fel vid sparande av fade-in settings:', error)
      }
    }
  }

  // --- Migrering och synk vid inloggning ---
  // Ta bort hela denna useEffect som hanterar migrering och alert

  // Spara useStartTimes till servern och localStorage vid ändring
  useEffect(() => {
    if (!userId) return
    localStorage.setItem(`useStartTimes_${userId}`, JSON.stringify(useStartTimes))
    // Hämta aktuell data från servern först
    const syncUseStartTimes = async () => {
      const serverData = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`).then(res => res.json())
      const queues = serverData.queues || []
      const startPoints = serverData.startPoints || {}
      const useStartTimes = serverData.useStartTimes || {}
      const fadeInSettings = serverData.fadeInSettings || {}
      // Skicka tillbaka hela objektet, men med uppdaterad useStartTimes
      await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, queues, startPoints, useStartTimes, fadeInSettings })
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
        <>
          {/* Desktop layout */}
          <div className="hidden lg:flex flex-col lg:flex-row h-screen">
            {/* Header - Desktop */}
            <div className="lg:hidden bg-spotify-dark border-b border-gray-800 p-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-white">Spotify Playlist</h1>
                <div className="flex items-center space-x-2">
                  {/* Statusindikator */}
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                       title={isConnected ? 'Ansluten till Spotify' : 'Inte ansluten till Spotify'} />
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Logga ut
                  </button>
                </div>
              </div>
            </div>

            {/* Vänster panel - Sökning och spellistor */}
            <div className="lg:w-1/2 bg-spotify-dark p-4 lg:p-6 overflow-y-auto flex-1 min-h-0">
              {/* Desktop header */}
              <div className="hidden lg:block mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    {/* Statusindikator */}
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                         title={isConnected ? 'Ansluten till Spotify' : 'Inte ansluten till Spotify'} />
                    <span className="text-sm text-gray-400">
                      {isConnected ? 'Ansluten' : 'Inte ansluten'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleClearQueue}
                      className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Rensa kö
                    </button>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Logga ut
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Sökning - Alltid synlig på desktop */}
              <div className="mb-6 lg:mb-8">
                <h2 className="text-xl lg:text-2xl font-bold text-white mb-4">Sök låtar</h2>
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

              {/* Sparade köer - Kollapsbar på desktop */}
              <div className="mb-6">
                <button
                  onClick={() => setShowQueues(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 mb-2 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm lg:text-base">Sparade köer</span>
                    <span className="text-xs text-gray-400">({playlist.length} låtar)</span>
                  </div>
                  <span className="text-lg">{showQueues ? '▲' : '▼'}</span>
                </button>
                {showQueues && (
                  <div className="bg-spotify-black rounded-lg p-3">
                    <QueueSaver
                      playlist={playlist}
                      accessToken={accessToken}
                      userId={userId}
                      onLoadQueue={async (tracks, name) => {
                        const tracksWithStartTimes = await loadSavedStartTimes(tracks)
                        setPlaylist(tracksWithStartTimes)
                        setPlaylistName(name)
                        console.log('Loaded queue:', { name, trackCount: tracks.length, tracksWithStartTimes: tracksWithStartTimes.map(t => ({ name: t.name, startTime: t.startTime })) })
                      }}
                    />
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">Köer sparas i databasen och synkroniseras mellan enheter.</div>
              </div>

              {/* Spotify-spellistor - Kollapsbar på desktop */}
              <div className="mb-6">
                <button
                  onClick={() => setShowSpotifyLists(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 mb-2 transition-colors"
                >
                  <span className="text-sm lg:text-base">Spotify-spellistor</span>
                  <span className="text-lg">{showSpotifyLists ? '▲' : '▼'}</span>
                </button>
                {showSpotifyLists && (
                  <div className="bg-spotify-black rounded-lg p-3">
                    <SpotifyPlaylistLoader
                      accessToken={accessToken}
                      onAddToPlaylist={handleAddToPlaylist}
                      onPlayTrack={handlePlayTrack}
                      onAddAllToQueue={handleAddAllToQueue}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Höger panel - Kö */}
            <div className="lg:w-1/2 bg-spotify-black p-4 lg:p-6 flex-1 flex flex-col min-h-0">
              <QueueManager
                playlist={playlist}
                onRemoveTrack={handleRemoveFromPlaylist}
                onPlayTrack={handlePlayTrack}
                onReorderTracks={handleReorderTracks}
                onClearQueue={handleClearQueue}
                accessToken={accessToken}
                userId={userId}
                useStartTimes={useStartTimes}
                setUseStartTimes={setUseStartTimes}
                startPoints={startPoints}
                fadeInSettings={fadeInSettings}
                onToggleFadeIn={handleToggleFadeIn}
                currentTrack={currentTrack}
                // Spotify Player props
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                isShuffled={isShuffled}
                isPlayerReady={isReady}
                onPlayNext={handlePlayNext}
                onPlayPrevious={handlePlayPrevious}
                onTogglePlay={handleTogglePlay}
                onVolumeChange={handleVolumeChange}
                onSeek={handleSeek}
                onShuffle={handleShuffle}
                isPlayerMinimized={isPlayerMinimized}
                onToggleMinimize={() => setIsPlayerMinimized(!isPlayerMinimized)}
              />
            </div>
          </div>

          {/* Mobil layout */}
          <div className="lg:hidden">
            {/* Header */}
            <div className="bg-spotify-dark border-b border-gray-800 p-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-white">Spotify Playlist</h1>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                       title={isConnected ? 'Ansluten till Spotify' : 'Inte ansluten till Spotify'} />
                  <button
                    onClick={handleClearQueue}
                    className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                  >
                    Rensa kö
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Logga ut
                  </button>
                </div>
              </div>
            </div>

            {/* Tab-innehåll */}
            <div className="pb-32">
              {/* Sök-tab */}
              {activeTab === 'search' && (
                <div className="p-4">
                  <h2 className="text-xl font-bold text-white mb-4">Sök låtar</h2>
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
              )}

              {/* Kö-tab */}
              {activeTab === 'queue' && (
                <div className="p-4 pb-8">
                  <QueueManager
                    playlist={playlist}
                    onRemoveTrack={handleRemoveFromPlaylist}
                    onPlayTrack={handlePlayTrack}
                    onReorderTracks={handleReorderTracks}
                    onClearQueue={handleClearQueue}
                    accessToken={accessToken}
                    userId={userId}
                    useStartTimes={useStartTimes}
                    setUseStartTimes={setUseStartTimes}
                    startPoints={startPoints}
                    fadeInSettings={fadeInSettings}
                    onToggleFadeIn={handleToggleFadeIn}
                    currentTrack={currentTrack}
                  />
                </div>
              )}

              {/* Sparade köer-tab */}
              {activeTab === 'saved' && (
                <div className="p-4">
                  <h2 className="text-xl font-bold text-white mb-4">Sparade köer</h2>
                  <div className="bg-spotify-black rounded-lg p-3">
                    <QueueSaver
                      playlist={playlist}
                      accessToken={accessToken}
                      userId={userId}
                      onLoadQueue={async (tracks, name) => {
                        const tracksWithStartTimes = await loadSavedStartTimes(tracks)
                        setPlaylist(tracksWithStartTimes)
                        setPlaylistName(name)
                        console.log('Loaded queue:', { name, trackCount: tracks.length, tracksWithStartTimes: tracksWithStartTimes.map(t => ({ name: t.name, startTime: t.startTime })) })
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-2">Köer sparas i databasen och synkroniseras mellan enheter.</div>
                </div>
              )}

              {/* Spotify-spellistor-tab */}
              {activeTab === 'playlists' && (
                <div className="p-4">
                  <h2 className="text-xl font-bold text-white mb-4">Spotify-spellistor</h2>
                  <div className="bg-spotify-black rounded-lg p-3">
                    <SpotifyPlaylistLoader
                      accessToken={accessToken}
                      onAddToPlaylist={handleAddToPlaylist}
                      onPlayTrack={handlePlayTrack}
                      onAddAllToQueue={handleAddAllToQueue}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom navigation - Alltid synlig på mobil */}
            <div className="fixed bottom-0 left-0 right-0 bg-spotify-dark border-t border-gray-800 lg:hidden z-10">
              <div className="flex items-center justify-around py-2">
                <button
                  onClick={() => setActiveTab('search')}
                  className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === 'search' ? 'text-spotify-green' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <span className="text-xs">Sök</span>
                </button>

                <button
                  onClick={() => setActiveTab('queue')}
                  className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === 'queue' ? 'text-spotify-green' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                  </svg>
                  <span className="text-xs">Kö</span>
                </button>

                <button
                  onClick={() => setActiveTab('saved')}
                  className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === 'saved' ? 'text-spotify-green' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                  </svg>
                  <span className="text-xs">Sparade</span>
                </button>

                <button
                  onClick={() => setActiveTab('playlists')}
                  className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === 'playlists' ? 'text-spotify-green' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                  </svg>
                  <span className="text-xs">Spellistor</span>
                </button>
              </div>
            </div>

                          {/* Spotify Player - Endast synlig på mobil */}
              <div className="lg:hidden">
                <SpotifyPlayer
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  volume={volume}
                  isShuffled={isShuffled}
                  isPlayerReady={isReady}
                  onPlayNext={handlePlayNext}
                  onPlayPrevious={handlePlayPrevious}
                  onTogglePlay={handleTogglePlay}
                  onVolumeChange={handleVolumeChange}
                  onSeek={handleSeek}
                  onShuffle={handleShuffle}
                  isMinimized={isPlayerMinimized}
                  onToggleMinimize={() => setIsPlayerMinimized(!isPlayerMinimized)}
                  playlist={playlist}
                  fadeInSettings={fadeInSettings}
                  onPlayTrack={handlePlayTrack}
                  startPoints={startPoints}
                  useStartTimes={useStartTimes}
                />
              </div>

              {/* Padding för att undvika overlap med bottom navigation och player */}
              <div className="h-16 lg:h-32"></div>
          </div>
        </>
      )}
    </div>
  )
} 