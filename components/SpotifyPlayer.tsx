import React, { useState } from 'react'
import { Track } from '../types/spotify'

interface SpotifyPlayerProps {
  currentTrack: any
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isShuffled: boolean
  isPlayerReady: boolean
  onPlayNext: () => void
  onPlayPrevious: () => void
  onTogglePlay: () => void
  onVolumeChange: (volume: number) => void
  onSeek: (positionMs: number) => void
  onShuffle: () => void
  isMinimized: boolean
  onToggleMinimize: () => void
  playlist: any[]
  fadeInSettings?: { [key: string]: boolean }
  onPlayTrack: (track: any, startTimeMs?: number) => void
  startPoints?: { [key: string]: number }
  useStartTimes?: { [key: string]: boolean }
}

export default function SpotifyPlayer({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isShuffled,
  isPlayerReady,
  onPlayNext,
  onPlayPrevious,
  onTogglePlay,
  onVolumeChange,
  onSeek,
  onShuffle,
  isMinimized,
  onToggleMinimize,
  playlist,
  fadeInSettings = {},
  onPlayTrack,
  startPoints = {},
  useStartTimes = {}
}: SpotifyPlayerProps) {
  const [isFading, setIsFading] = useState(false)
  const [fadeProgress, setFadeProgress] = useState(0)
  const fadeTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekPercentage = parseFloat(e.target.value)
    const seekPositionMs = Math.floor((seekPercentage / 100) * duration)
    onSeek(seekPositionMs)
  }

  // Fade-funktion
  const handleNextWithFade = async () => {
    if (isFading) return // förhindra dubbelklick
    setIsFading(true)
    setFadeProgress(0)
    let fadeDuration = 10000 // 10 sekunder
    const timeLeft = duration - currentTime
    if (timeLeft < fadeDuration) fadeDuration = timeLeft
    const steps = 20
    const stepTime = fadeDuration / steps
    const startVolume = volume
    
    for (let i = 1; i <= steps; i++) {
      fadeTimeoutRef.current = setTimeout(() => {
        const newVolume = Math.max(0, Math.round(startVolume * (1 - i / steps)))
        onVolumeChange(newVolume)
        setFadeProgress(i / steps)
        
        if (i === steps) {
          // När fade-out är klar, spela nästa låt
          setTimeout(async () => {
            try {
              // Hitta nästa låt i playlisten
              const currentTrackIndex = playlist.findIndex(track => track.id === currentTrack?.id)
              let nextIndex: number
              if (isShuffled) {
                nextIndex = Math.floor(Math.random() * playlist.length)
              } else {
                nextIndex = (currentTrackIndex + 1) % playlist.length
              }
              
              const nextTrack = playlist[nextIndex]
              if (nextTrack) {
                // Kontrollera fade-in inställning för nästa låt
                const shouldFadeIn = fadeInSettings[nextTrack.id] || false
                
                // Hämta starttid för nästa låt
                const nextTrackStartTime = useStartTimes[nextTrack.id] ? startPoints[nextTrack.id] : undefined
                
                console.log('Playing next track after fade-out:', {
                  trackName: nextTrack.name,
                  shouldFadeIn,
                  startTime: nextTrackStartTime
                })
                
                // Spela nästa låt med starttid om den finns
                await onPlayTrack(nextTrack, nextTrackStartTime)
              }
              
              // Återställ volym efter en kort paus
              setTimeout(() => {
                onVolumeChange(startVolume)
                setIsFading(false)
                setFadeProgress(0)
              }, 500)
            } catch (error) {
              console.error('Fel vid uppspelning av nästa låt efter fade-out:', error)
              // Återställ volym även vid fel
              onVolumeChange(startVolume)
              setIsFading(false)
              setFadeProgress(0)
            }
          }, 200)
        }
      }, i * stepTime)
    }
  }

  // Cleanup fade timeout
  React.useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    }
  }, [])

  // Visa "Försök igen"-knapp om spelaren inte är redo
  if (!isPlayerReady) {
    return (
      <div className="fixed bottom-16 left-0 right-0 bg-yellow-900 border-t border-yellow-700 z-20 lg:relative lg:bottom-0 lg:left-0 lg:right-0 lg:mt-4">
        <div className="p-3 lg:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span className="text-yellow-300 text-sm font-medium">Spotify-spelaren är inte redo</span>
            </div>
            <button
              onClick={() => {
                // Försök starta om spelaren genom att klicka på play/pause
                onTogglePlay()
              }}
              className="px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
            >
              Försök igen
            </button>
          </div>
          <p className="text-yellow-200 text-xs mt-1">
            Kontrollera att Spotify-appen är öppen och att du är inloggad
          </p>
        </div>
      </div>
    )
  }

  // Kompakt vy när minimerad
  if (isMinimized && currentTrack) {
    return (
      <div className="fixed bottom-16 left-0 right-0 bg-spotify-dark border-t border-gray-700 z-20 lg:relative lg:bottom-0 lg:left-0 lg:right-0 lg:mt-4">
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={onToggleMinimize}
        >
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {currentTrack?.album?.images?.[0]?.url && (
              <img 
                src={currentTrack.album.images[0].url} 
                alt={currentTrack.name} 
                className="w-10 h-10 rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white text-sm truncate">{currentTrack?.name}</p>
              <p className="text-xs text-spotify-light truncate">
                {currentTrack?.artists?.[0]?.name || 'Okänd artist'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onShuffle()
              }}
              className={`w-8 h-8 flex items-center justify-center rounded-full border border-gray-600 transition-colors ${
                isShuffled ? 'bg-spotify-green text-white' : 'text-white hover:text-spotify-green'
              }`}
              title={isShuffled ? 'Slumpmässig av' : 'Slumpmässig på'}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
              </svg>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                onPlayPrevious()
              }}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-spotify-green"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePlay()
              }}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPlayNext()
              }}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-spotify-green"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                handleNextWithFade()
              }}
              className="w-8 h-8 flex items-center justify-center bg-yellow-600 text-white rounded-full hover:bg-yellow-700 transition-colors disabled:opacity-50"
              title="Nästa låt med fade"
              disabled={isFading}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Full vy när expanderad
  if (!isMinimized && currentTrack) {
    return (
      <div className="fixed bottom-16 left-0 right-0 bg-spotify-dark border-t border-gray-700 z-20 lg:relative lg:bottom-0 lg:left-0 lg:right-0 lg:mt-4">
        <div className="p-3 lg:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base lg:text-lg font-semibold text-white">Nu spelar</h3>
            <button
              onClick={onToggleMinimize}
              className="text-white hover:text-spotify-green"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              {currentTrack?.album?.images?.[0]?.url && (
                <img src={currentTrack.album.images[0].url} alt={currentTrack.name} className="w-12 h-12 lg:w-16 lg:h-16 rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm lg:text-base truncate">{currentTrack?.name}</p>
                <p className="text-xs lg:text-sm text-spotify-light truncate">
                  {currentTrack?.artists?.[0]?.name || 'Okänd artist'}
                </p>
              </div>
            </div>
            
            {/* Progress bar med spolmarkör */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-spotify-light">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={duration > 0 ? (currentTime / duration) * 100 : 0}
                  onChange={handleSeek}
                  className="w-full h-1.5 lg:h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #4B5563 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #4B5563 100%)`
                  }}
                />
              </div>
            </div>

            {/* Kontroller - Spotify-liknande */}
            <div className="flex justify-center items-center space-x-3 lg:space-x-4">
              <button
                onClick={onShuffle}
                className={`p-2 lg:p-3 rounded-full border border-gray-600 transition-colors ${
                  isShuffled ? 'bg-spotify-green text-white' : 'bg-spotify-dark text-white hover:bg-gray-700'
                }`}
                title={isShuffled ? 'Slumpmässig av' : 'Slumpmässig på'}
              >
                <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
              </button>
              
              <button
                onClick={onPlayPrevious}
                className="p-2 lg:p-3 bg-spotify-dark text-white rounded-full hover:bg-gray-700 border border-gray-600 transition-colors"
                title="Föregående låt"
              >
                <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>
              
              <button
                onClick={onTogglePlay}
                className="p-3 lg:p-4 bg-spotify-green text-white rounded-full hover:bg-green-600 transition-colors shadow-lg"
                title={isPlaying ? 'Pausa' : 'Spela'}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              
              <button
                onClick={onPlayNext}
                className="p-2 lg:p-3 bg-spotify-dark text-white rounded-full hover:bg-gray-700 border border-gray-600 transition-colors"
                title="Nästa låt"
              >
                <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
              </button>
              
              <button
                onClick={handleNextWithFade}
                className="p-2 lg:p-3 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 border border-yellow-700 transition-colors disabled:opacity-50"
                title="Nästa låt med fade"
                disabled={isFading}
              >
                <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </button>
            </div>

            {/* Volymkontroll */}
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-spotify-light" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onVolumeChange(parseInt(e.target.value))}
                className="flex-1 h-1.5 lg:h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${volume}%, #4B5563 ${volume}%, #4B5563 100%)`
                }}
              />
              <span className="text-xs text-spotify-light w-8 text-right">{volume}%</span>
            </div>
          </div>
          {isFading && (
            <div className="w-full px-3 pb-2 flex flex-col items-center">
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-1 bg-yellow-400 transition-all"
                  style={{ width: `${Math.round(fadeProgress * 100)}%` }}
                />
              </div>
              <span className="text-xs text-yellow-300 mt-1">Fadar ut... {Math.round(fadeProgress * 100)}%</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Ingen låt spelar - visa tom spelare
  return (
    <div className="fixed bottom-16 left-0 right-0 bg-spotify-dark border-t border-gray-700 z-20 lg:relative lg:bottom-0 lg:left-0 lg:right-0 lg:mt-4">
      <div className="p-3 lg:p-4">
        <div className="flex items-center justify-center">
          <p className="text-spotify-light text-sm">Ingen låt spelar</p>
        </div>
      </div>
    </div>
  )
} 