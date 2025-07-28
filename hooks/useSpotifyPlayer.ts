import { useState, useEffect, useRef, useCallback } from 'react'
import { SpotifyPlayer, SpotifyPlaybackState, SpotifyTrack, SpotifyDevice } from '@/types/spotify'

declare global {
  interface Window {
    Spotify: {
      Player: new (config: any) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

export const useSpotifyPlayer = (accessToken: string | null, onTrackEnd?: () => void) => {
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.5)
  const [error, setError] = useState<string | null>(null)
  const [isSDKReady, setIsSDKReady] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [devices, setDevices] = useState<SpotifyDevice[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)

  
  const playerRef = useRef<SpotifyPlayer | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const pendingAccessTokenRef = useRef<string | null>(null)
  const currentTrackIdRef = useRef<string | null>(null)
  const hasTriggeredEndRef = useRef(false)

  // Ladda Spotify Web Playback SDK
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Spotify) {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      
      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('Spotify Web Playback SDK redo')
        setIsSDKReady(true)
        
        // Om det finns en pending access token, försök initialisera spelaren
        if (pendingAccessTokenRef.current) {
          console.log('SDK ready, attempting to initialize player with pending token')
          initializePlayer(pendingAccessTokenRef.current)
        }
      }
      
      document.head.appendChild(script)
    } else if (window.Spotify) {
      setIsSDKReady(true)
      // Om det finns en access token, initialisera spelaren direkt
      if (accessToken) {
        console.log('Spotify SDK already available, initializing player')
        initializePlayer(accessToken)
      }
    }
  }, [])

  // Skapa och konfigurera spelaren
  const initializePlayer = useCallback(async (accessToken: string) => {
    console.log('=== initializePlayer called ===')
    console.log('window.Spotify exists:', !!window.Spotify)
    console.log('isSDKReady:', isSDKReady)
    console.log('playerRef.current exists:', !!playerRef.current)
    console.log('isInitializing:', isInitializing)
    
    if (!window.Spotify) {
      console.log('SDK not ready, saving access token for later')
      pendingAccessTokenRef.current = accessToken
      return
    }
    
    if (playerRef.current) {
      console.log('Player already exists, skipping initialization')
      return
    }
    
    if (isInitializing) {
      console.log('Player initialization already in progress, skipping')
      return
    }

    try {
      console.log('=== Initializing Spotify Player ===')
      setIsInitializing(true)
      accessTokenRef.current = accessToken
      pendingAccessTokenRef.current = null // Rensa pending token
      currentTrackIdRef.current = null // Återställ track ID
      hasTriggeredEndRef.current = false // Återställ trigger flag
      
      const player = new window.Spotify.Player({
        name: 'Spotify Playlist Creator',
        getOAuthToken: (cb: (token: string) => void) => { cb(accessToken) },
        volume: 0.5
      })

      // Event listeners
      player.addListener('ready', ({ device_id }) => {
        console.log('=== Player Ready ===')
        console.log('Device ID:', device_id)
        console.log('Setting player as connected...')
        setIsConnected(true)
        setDeviceId(device_id)
        setIsReady(true)
        setError(null)
        console.log('Player ready event completed')
      })

      player.addListener('not_ready', ({ device_id }) => {
        console.log('=== Player Not Ready ===')
        console.log('Device ID:', device_id)
        console.log('Setting player as disconnected...')
        setIsConnected(false)
        setIsReady(false)
        currentTrackIdRef.current = null
        hasTriggeredEndRef.current = false
        console.log('Player not ready event completed')
      })

      player.addListener('initialization_error', ({ message }) => {
        console.error('=== Initialization Error ===')
        console.error('Message:', message)
        setError(`Initialiseringsfel: ${message}`)
      })

      player.addListener('authentication_error', ({ message }) => {
        console.error('=== Authentication Error ===')
        console.error('Message:', message)
        setError(`Autentiseringsfel: ${message}`)
        // Visa användarvänligt felmeddelande
        alert('Spotify-autentisering misslyckades. Logga in igen för att fortsätta.')
      })

      player.addListener('account_error', ({ message }) => {
        console.error('=== Account Error ===')
        console.error('Message:', message)
        setError(`Kontofel: ${message}`)
        // Visa användarvänligt felmeddelande
        alert('Spotify-kontofel. Kontrollera ditt Spotify-konto och försök igen.')
      })

      player.addListener('playback_error', ({ message }) => {
        console.error('=== Playback Error ===')
        console.error('Message:', message)
        setError(`Uppspelningsfel: ${message}`)
        // Visa användarvänligt felmeddelande
        alert('Uppspelningsfel. Kontrollera att Spotify-appen är öppen och försök igen.')
      })

      player.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => {
        if (state) {
          const newTrack = state.track_window.current_track
          
          setCurrentTrack(newTrack)
          setIsPlaying(!state.paused)
          setCurrentTime(state.position)
          setDuration(state.duration)
          
          // Återställ flaggan när låten byts
          if (newTrack?.id && newTrack.id !== currentTrackIdRef.current) {
            console.log('Låt bytt från', currentTrackIdRef.current, 'till', newTrack.id)
            currentTrackIdRef.current = newTrack.id
            hasTriggeredEndRef.current = false
          } else if (newTrack?.id && !currentTrackIdRef.current) {
            // Första gången låten sätts
            console.log('Första låten satt till:', newTrack.id)
            currentTrackIdRef.current = newTrack.id
          }
        } else {
          setCurrentTrack(null)
          setIsPlaying(false)
          setCurrentTime(0)
          setDuration(0)
          currentTrackIdRef.current = null
          hasTriggeredEndRef.current = false
        }
      })

      // Anslut spelaren
      console.log('Attempting to connect player...')
      console.log('Player object:', player)
      console.log('Player connect method exists:', typeof player.connect)
      
      try {
        console.log('About to call player.connect()...')
        
        // Anslut spelaren utan timeout (Spotify hanterar detta internt)
        const connected = await player.connect()
        console.log('Player connect result:', connected)
        
        // Sätt spelaren men vänta på 'ready' event innan vi markerar som redo
        console.log('Player connected successfully, setting up...')
        setPlayer(player)
        playerRef.current = player
        
        // Ladda nuvarande volym från Spotify
        try {
          const currentVolume = await player.getVolume()
          // Konvertera från 0-1 till 0-100 för UI
          const uiVolume = Math.round(currentVolume * 100)
          setVolume(uiVolume)
          console.log('Loaded current volume from Spotify:', currentVolume, '(UI volume:', uiVolume, ')')
        } catch (error) {
          console.error('Fel vid laddning av volym:', error)
        }
      } catch (connectError) {
        console.error('Player connect error:', connectError)
        // Fortsätt ändå, spelaren kan fortfarande fungera
        console.log('Continuing despite connect error...')
        setPlayer(player)
        playerRef.current = player
        // Sätt inte isReady här - vänta på 'ready' event
      }
    } catch (error) {
      console.error('Fel vid initialisering av spelaren:', error)
      setError('Kunde inte initialisera spelaren')
    } finally {
      setIsInitializing(false)
    }
  }, [isInitializing])

  // Initialisera spelaren när access token ändras
  useEffect(() => {
    if (accessToken && window.Spotify) {
      console.log('Initializing player with access token and Spotify SDK')
      initializePlayer(accessToken)
    } else if (accessToken && !window.Spotify) {
      console.log('Access token available but Spotify SDK not ready yet')
    }
  }, [accessToken, initializePlayer])

  // Kontrollera när Spotify SDK blir tillgängligt (endast en gång)
  useEffect(() => {
    if (window.Spotify && accessToken && !playerRef.current && !isInitializing) {
      console.log('Spotify SDK became available, initializing player')
      initializePlayer(accessToken)
    }
  }, [accessToken, initializePlayer, isInitializing])

  // Funktion för att hämta tillgängliga enheter
  const fetchDevices = useCallback(async () => {
    if (!accessTokenRef.current) return
    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${accessTokenRef.current}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices)
        const active = data.devices.find((d: SpotifyDevice) => d.is_active)
        setActiveDeviceId(active ? active.id : null)
      } else {
        setDevices([])
        setActiveDeviceId(null)
      }
    } catch (error) {
      setDevices([])
      setActiveDeviceId(null)
    }
  }, [])

  // Hämta enheter när accessToken ändras eller när spelaren blir redo
  useEffect(() => {
    if (accessToken && isReady) {
      fetchDevices()
    }
  }, [accessToken, isReady, fetchDevices])

  // Spela en låt med Track-objekt
  const playTrack = useCallback(async (track: any, startTimeMs?: number, fadeIn?: boolean) => {
    console.log('=== playTrack called ===')
    console.log('Player ref exists:', !!playerRef.current)
    console.log('Is connected:', isConnected)
    console.log('Device ID:', deviceId)
    console.log('Access token exists:', !!accessTokenRef.current)
    console.log('Track:', track)
    console.log('Start time (ms):', startTimeMs)
    console.log('Fade in:', fadeIn)
    
    if (!playerRef.current || !isConnected) {
      let errorMsg = 'Spotify-spelaren är inte redo än. '
      if (!playerRef.current) {
        errorMsg += 'Spelaren har inte initialiserats. '
      }
      if (!isConnected) {
        errorMsg += 'Spelaren är inte ansluten till Spotify. '
      }
      errorMsg += 'Vänta lite och försök igen.'
      console.error(errorMsg)
      setError(errorMsg)
      throw new Error(errorMsg)
    }

    if (!deviceId) {
      const errorMsg = 'Inget device ID tillgängligt'
      console.error(errorMsg)
      setError(errorMsg)
      throw new Error(errorMsg)
    }

    try {
      console.log('Playing track:', track.name, 'at position:', startTimeMs, 'with fade-in:', fadeIn)
      
      const trackUri = track.uri || track
      const requestBody: any = {
        uris: [trackUri]
      }
      
      // Lägg till position_ms direkt i play request
      if (startTimeMs && startTimeMs > 0) {
        requestBody.position_ms = startTimeMs
      }
      
      console.log('Request body:', requestBody)
      console.log('Device ID for request:', deviceId)
      
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessTokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        const errorMsg = `Kunde inte spela låten: ${response.status} ${errorText}`
        setError(errorMsg)
        throw new Error(errorMsg)
      }
      
      console.log('Track play successful')
      
      // Implementera fade-in om det är aktiverat
      if (fadeIn && playerRef.current) {
        console.log('Starting fade-in effect')
        
        // Hämta användarens aktuella volym först
        const currentVolume = volume / 100 // Konvertera från 0-100 till 0-1
        console.log('Current user volume:', currentVolume)
        
        // Sätt volym till 0 först
        await playerRef.current.setVolume(0)
        
        // Fade in över 5 sekunder till användarens volym
        const fadeDuration = 5000 // 5 sekunder
        const fadeSteps = 50 // 50 steg för smidig fade
        const volumeStep = currentVolume / fadeSteps
        const stepDuration = fadeDuration / fadeSteps
        
        for (let i = 0; i <= fadeSteps; i++) {
          setTimeout(async () => {
            try {
              if (playerRef.current) {
                const targetVolume = i * volumeStep
                await playerRef.current.setVolume(targetVolume)
                console.log(`Fade-in step ${i}/${fadeSteps}, volume: ${targetVolume} (target: ${currentVolume})`)
              }
            } catch (error) {
              console.error('Fel vid fade-in steg:', error)
            }
          }, i * stepDuration)
        }
      }
    } catch (error) {
      console.error('Fel vid uppspelning:', error)
      const errorMsg = `Kunde inte spela låten: ${error instanceof Error ? error.message : 'Okänt fel'}`
      setError(errorMsg)
      throw error // Kasta fel vidare så att anropande kod kan hantera det
    }
  }, [isConnected, deviceId])

  // Spela en spellista
  const playPlaylist = useCallback(async (trackUris: string[], startIndex: number = 0, startTimeMs?: number) => {
    if (!playerRef.current || !isConnected) {
      const errorMsg = 'Spelaren är inte ansluten'
      setError(errorMsg)
      throw new Error(errorMsg)
    }

    try {
      console.log('=== Playing playlist ===')
      console.log('Track URIs:', trackUris)
      console.log('Start index:', startIndex)
      console.log('Start time (ms):', startTimeMs)
      console.log('Access token exists:', !!accessTokenRef.current)
      
      // Kontrollera om användaren har en aktiv Spotify-session
      const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessTokenRef.current}`
        }
      })
      
      if (!userResponse.ok) {
        const errorMsg = 'Ogiltig access token'
        setError(errorMsg)
        throw new Error(errorMsg)
      }
      
      const userData = await userResponse.json()
      console.log('User data:', userData.display_name)
      
      const requestBody: any = {
        uris: trackUris,
        offset: { position: startIndex }
      }
      
      // Lägg till position_ms om starttid finns
      if (startTimeMs && startTimeMs > 0) {
        requestBody.position_ms = startTimeMs
      }
      
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessTokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Playlist play response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Playlist play error response:', errorText)
        
        if (response.status === 404) {
          const errorMsg = 'Ingen aktiv Spotify-session. Öppna Spotify-appen och försök igen.'
          setError(errorMsg)
          throw new Error(errorMsg)
        }
        
        const errorMsg = `Kunde inte spela spellistan: ${response.status} ${errorText}`
        setError(errorMsg)
        throw new Error(errorMsg)
      }
      
      console.log('Playlist play successful')
    } catch (error) {
      console.error('Fel vid uppspelning av spellista:', error)
      const errorMsg = `Kunde inte spela spellistan: ${error instanceof Error ? error.message : 'Okänt fel'}`
      setError(errorMsg)
      throw error // Kasta fel vidare så att anropande kod kan hantera det
    }
  }, [isConnected, deviceId])

  // Kontroller
  const play = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.resume()
    }
  }, [])

  const pause = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.pause()
    }
  }, [])

  const nextTrack = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.nextTrack()
    }
  }, [])

  const previousTrack = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.previousTrack()
    }
  }, [])

  const setPlayerVolume = useCallback(async (newVolume: number) => {
    if (playerRef.current) {
      try {
        // Konvertera från 0-100 till 0-1 för Spotify
        const spotifyVolume = newVolume / 100
        console.log('Setting player volume to:', newVolume, '(Spotify volume:', spotifyVolume, ')')
        await playerRef.current.setVolume(spotifyVolume)
        setVolume(newVolume)
        console.log('Volume set successfully')
      } catch (error) {
        console.error('Fel vid inställning av volym:', error)
      }
    } else {
      console.log('Player not ready, cannot set volume')
    }
  }, [])

  const seekTo = useCallback(async (positionMs: number) => {
    if (playerRef.current && isConnected) {
      try {
        console.log('Seeking to position:', positionMs, 'ms')
        await playerRef.current.seek(positionMs)
      } catch (error) {
        console.error('Fel vid spolning:', error)
        setError(`Kunde inte spola: ${error instanceof Error ? error.message : 'Okänt fel'}`)
      }
    }
  }, [isConnected])

  // Enkel timer för att detektera när låten är klar
  useEffect(() => {
    if (!isConnected) {
      console.log('Timer: inte ansluten, avbryter')
      return
    }

    console.log('Startar timer för track end detection')

    const checkTrackEnd = setInterval(async () => {
      console.log('Timer tick - kontrollerar track end')
      
      if (playerRef.current) {
        try {
          const state = await playerRef.current.getCurrentState()
          console.log('Timer: fick state:', {
            hasState: !!state,
            hasTrack: !!(state && state.track_window.current_track),
            position: state?.position,
            duration: state?.duration,
            isPaused: state?.paused
          })
          
          if (state && state.track_window.current_track) {
            const currentTrackId = state.track_window.current_track.id
            const newPosition = state.position
            const newDuration = state.duration
            
            // Detektera om låten är klar (nära slutet eller slutar)
            if (newDuration > 0) {
              const timeRemaining = newDuration - newPosition
              
              console.log('Timer: kontrollerar timeRemaining:', {
                timeRemaining,
                position: newPosition,
                duration: newDuration,
                isPaused: state.paused,
                hasTriggeredEnd: hasTriggeredEndRef.current,
                currentTrackId
              })
              
              // Om låten är nära slutet OCH inte redan triggat
              if (timeRemaining < 1000 && !hasTriggeredEndRef.current) {
                console.log('Låten är klar, anropar onTrackEnd callback:', {
                  timeRemaining,
                  isPaused: state.paused,
                  currentTrackId
                })
                hasTriggeredEndRef.current = true
                onTrackEnd?.()
              }
              
              // Alternativ: Om låten har slutat (position 0 och pausad) och inte redan triggat
              if (newPosition === 0 && state.paused && !hasTriggeredEndRef.current) {
                console.log('Låten har slutat (position 0, pausad), anropar onTrackEnd callback:', {
                  timeRemaining,
                  isPaused: state.paused,
                  currentTrackId
                })
                hasTriggeredEndRef.current = true
                onTrackEnd?.()
              }
            }
          }
        } catch (error) {
          console.error('Fel vid kontroll av låt:', error)
        }
      } else {
        console.log('Timer: playerRef.current är null')
      }
    }, 2000) // Kontrollera var 2:a sekund

    return () => {
      console.log('Stoppar timer för track end detection')
      clearInterval(checkTrackEnd)
    }
  }, [isConnected])

  // Separata timer för UI-uppdateringar (position och volym)
  useEffect(() => {
    if (!isConnected) return

    const uiTimer = setInterval(async () => {
      if (playerRef.current) {
        try {
          const state = await playerRef.current.getCurrentState()
          if (state) {
            setCurrentTime(state.position)
            setDuration(state.duration)
          }
        } catch (error) {
          console.error('Fel vid UI-uppdatering:', error)
        }
      }
    }, 100) // Uppdatera var 100ms för smidig UI

    return () => {
      clearInterval(uiTimer)
    }
  }, [isConnected])

  // Cleanup
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect()
      }
    }
  }, [])

  return {
    player,
    isConnected,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    error,
    isReady,
    initializePlayer,
    playTrack,
    playPlaylist,
    play,
    pause,
    nextTrack,
    previousTrack,
    setPlayerVolume,
    seekTo,
    // Alias för kompatibilitet
    pauseTrack: pause,
    resumeTrack: play,
    playNext: nextTrack,
    playPrevious: previousTrack,
    // Nya för enhetshantering
    devices,
    activeDeviceId,
    fetchDevices
  }
} 