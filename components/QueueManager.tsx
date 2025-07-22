'use client'

import { useState, useEffect, useRef } from 'react'
import { Track } from '@/types/spotify'
import StartTimeEditor from './StartTimeEditor'

interface QueueManagerProps {
  playlist: Track[]
  onRemoveTrack: (index: number) => void
  onPlayTrack: (track: Track, startTimeMs?: number) => void
  onPlayNext: () => void
  onPlayPrevious: () => void
  onTogglePlay: () => void
  onVolumeChange: (volume: number) => void
  onSeek?: (positionMs: number) => void
  onShuffle: () => void
  isPlaying: boolean
  currentTrack: any
  currentTime: number
  duration: number
  volume: number
  isShuffled: boolean
  currentTrackIndex: number
  onReorderTracks: (tracks: Track[]) => void
  onClearQueue: () => void
  accessToken?: string | null
  userId?: string | null
  useStartTimes?: { [key: string]: boolean }
  setUseStartTimes?: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>
  startPoints?: { [key: string]: number }
}

export default function QueueManager({
  playlist,
  onRemoveTrack,
  onPlayTrack,
  onPlayNext,
  onPlayPrevious,
  onTogglePlay,
  onVolumeChange,
  onSeek,
  onShuffle,
  isPlaying,
  currentTrack,
  currentTime,
  duration,
  volume,
  isShuffled,
  currentTrackIndex,
  onReorderTracks,
  onClearQueue,
  accessToken,
  userId,
  useStartTimes: externalUseStartTimes,
  setUseStartTimes: externalSetUseStartTimes,
  startPoints = {}
}: QueueManagerProps) {

  const [editingTrack, setEditingTrack] = useState<string | null>(null)
  const [internalUseStartTimes, setInternalUseStartTimes] = useState<{ [key: string]: boolean }>({})
  const [fadeProgress, setFadeProgress] = useState(0)
  
  // Använd externa useStartTimes om de finns, annars interna
  const useStartTimes = externalUseStartTimes || internalUseStartTimes
  const setUseStartTimes = externalSetUseStartTimes || setInternalUseStartTimes
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isFading, setIsFading] = useState(false)
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  console.log('QueueManager render:', {
    playlistLength: playlist.length,
    trackNames: playlist.map(t => t.name)
  })

  // Ta bort localStorage-hantering av startTimes

  // Spara starttider till servern
  const saveStartTimes = async (newStartTimes: { [key: string]: number }) => {
    if (!userId) return;
    try {
      // Hämta aktuell kö från servern
      const resGet = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
      let queues = []
      let useStartTimesToSend = useStartTimes
      if (resGet.ok) {
        const data = await resGet.json()
        queues = data.queues || []
        // Om useStartTimes är tomt, använd det från servern
        if (!useStartTimesToSend || Object.keys(useStartTimesToSend).length === 0) {
          useStartTimesToSend = data.useStartTimes || {}
        }
      }
      // Spara till databasen
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          queues,
          startPoints: newStartTimes,
          useStartTimes: useStartTimesToSend
        })
      })
      if (res.ok) {
        console.log('Saved start times to database for user:', userId)
      } else {
        console.error('Failed to save start times to database')
      }
    } catch (error) {
      console.error('Fel vid sparande av starttider:', error)
    }
  }

  // Debug: logga när playlist ändras
  useEffect(() => {
    console.log('QueueManager playlist changed:', {
      length: playlist.length,
      tracks: playlist.map(t => t.name)
    })
  }, [playlist])

  const handleStartTimeEdit = (trackId: string) => {
    setEditingTrack(trackId)
  }

  const handleStartTimeSave = async (trackId: string, startTimeMs: number) => {
    if (!userId) return;
    const newStartTimes = { ...startPoints, [trackId]: startTimeMs }
    // setStartTimes(newStartTimes) // Ta bort
    await saveStartTimes(newStartTimes)
    
    // Automatiskt sätta useStartTimes till true för denna låt
    setUseStartTimes(prev => {
      const newUseStartTimes = { ...prev, [trackId]: true }
      // Spara till databasen
      const saveToDatabase = async () => {
        try {
          const resGet = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
          let queues = []
          let startPointsToSend = newStartTimes
          if (resGet.ok) {
            const data = await resGet.json()
            queues = data.queues || []
            if (!startPointsToSend || Object.keys(startPointsToSend).length === 0) {
              startPointsToSend = data.startPoints || {}
            }
          }
          const res = await fetch('/api/queues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId, 
              queues,
              startPoints: startPointsToSend,
              useStartTimes: newUseStartTimes
            })
          })
          if (res.ok) {
            console.log('Saved useStartTimes to database for user:', userId)
          } else {
            console.error('Failed to save useStartTimes to database')
          }
        } catch (error) {
          console.error('Fel vid sparande av useStartTimes till databasen:', error)
        }
      }
      saveToDatabase()
      console.log('Auto-set useStartTimes to true for track:', trackId)
      return newUseStartTimes
    })
    
    // Uppdatera spellistan i huvudkomponenten med nya starttider
    const updatedPlaylist = playlist.map(track => ({
      ...track,
      startTime: track.id === trackId ? startTimeMs : track.startTime
    }))
    onReorderTracks(updatedPlaylist)
    
    setEditingTrack(null)
  }

  const handleStartTimeCancel = () => {
    setEditingTrack(null)
  }

  const toggleStartTimeUsage = async (trackId: string) => {
    if (!userId) return;
    const newUseStartTimes = {
      ...useStartTimes,
      [trackId]: !useStartTimes[trackId]
    };
    setUseStartTimes(newUseStartTimes);

    // Spara till databasen
    try {
      const resGet = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`);
      let queues = [];
      let startPointsToSend = startPoints;
      if (resGet.ok) {
        const data = await resGet.json();
        queues = data.queues || [];
        startPointsToSend = data.startPoints || startPoints;
      }
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          queues,
          startPoints: startPointsToSend,
          useStartTimes: newUseStartTimes
        })
      });
      if (res.ok) {
        console.log('Saved useStartTimes to database for user:', userId);
      } else {
        console.error('Failed to save useStartTimes to database');
      }
    } catch (error) {
      console.error('Fel vid sparande av useStartTimes till databasen:', error);
    }

    // Uppdatera spellistan i huvudkomponenten för att reflektera ändringen
    const updatedPlaylist = playlist.map(track => ({
      ...track,
      // Behåll startTime men låt useStartTimes styra om den används
    }));
    onReorderTracks(updatedPlaylist);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    console.log('Drag start:', { index, trackName: playlist[index]?.name })
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    // Sätt inte JSON data för omordning - det är bara för nya låtar från vänster
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
    console.log('Drag over:', { index, draggedIndex, trackName: playlist[index]?.name })
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Kontrollera om det är en låt från vänster sida (JSON data) eller omordning (text data)
    const jsonData = e.dataTransfer.getData('application/json')
    const textData = e.dataTransfer.getData('text/plain')
    
    console.log('Drop event:', { jsonData: !!jsonData, textData: !!textData, dropIndex, draggedIndex })
    
    if (jsonData && !textData) {
      // Lägg till ny låt från vänster sida (endast JSON data, ingen text data)
      try {
        const track = JSON.parse(jsonData)
        console.log('Adding track from left side:', track.name)
        const newPlaylist = [...playlist]
        newPlaylist.splice(dropIndex, 0, track)
        onReorderTracks(newPlaylist)
      } catch (error) {
        console.error('Fel vid drop av låt:', error)
      }
    } else if (textData) {
      // Omordna befintliga låtar (text data från drag start)
      const sourceIndex = parseInt(textData)
      console.log('Reordering existing track:', { sourceIndex, dropIndex, draggedIndex })
      
      if (sourceIndex === dropIndex) {
        console.log('Same position, no change needed')
        setDraggedIndex(null)
        setDragOverIndex(null)
        return
      }

      // Skapa ny array med omordnade låtar
      const newPlaylist = [...playlist]
      const draggedTrack = newPlaylist[sourceIndex]
      
      console.log('Reordering tracks:', {
        sourceIndex,
        dropIndex,
        draggedTrack: draggedTrack.name,
        oldOrder: newPlaylist.map(t => t.name)
      })
      
      // Ta bort låten från original position
      newPlaylist.splice(sourceIndex, 1)
      
      // Lägg till låten på ny position
      newPlaylist.splice(dropIndex, 0, draggedTrack)
      
      console.log('New order:', newPlaylist.map(t => t.name))
      
      // Uppdatera playlist
      console.log('Calling onReorderTracks with:', newPlaylist.map(t => t.name))
      onReorderTracks(newPlaylist)
    }
    
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSeek && duration > 0) {
      const seekPercentage = parseFloat(e.target.value)
      const seekPositionMs = Math.floor((seekPercentage / 100) * duration)
      onSeek(seekPositionMs)
    }
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
          setTimeout(() => {
            onPlayNext()
            setTimeout(() => {
              onVolumeChange(startVolume)
              setIsFading(false)
              setFadeProgress(0)
            }, 500)
          }, 200)
        }
      }, i * stepTime)
    }
  }
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    }
  }, [])

  // Vid rendering, använd startPoints-prop direkt:
  const getTrackStartTime = (trackId: string) => startPoints[trackId] || 0;
  const getTrackUseStartTime = (trackId: string) => useStartTimes[trackId] || false;

  return (
    <div className="h-full flex flex-col">
      {/* Kö */}
      <div 
        className="flex-1 overflow-y-auto mb-4"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const jsonData = e.dataTransfer.getData('application/json')
          console.log('Main queue drop zone:', { jsonData: !!jsonData })
          if (jsonData) {
            try {
              const track = JSON.parse(jsonData)
              console.log('Adding track to end of queue:', track.name)
              const newPlaylist = [...playlist, track]
              onReorderTracks(newPlaylist)
            } catch (error) {
              console.error('Fel vid drop av låt:', error)
            }
          }
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">
            Kö ({playlist.length} låtar)
          </h3>
          {playlist.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Är du säker på att du vill rensa hela kön?')) {
                  onClearQueue()
                }
              }}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              title="Ta bort alla låtar från köen"
            >
              Rensa kö
            </button>
          )}
        </div>
        
        {playlist.length === 0 ? (
          <div 
            className="text-center py-8 border-2 border-dashed border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }}
                    onDrop={(e) => {
          e.preventDefault()
          const jsonData = e.dataTransfer.getData('application/json')
          console.log('Empty queue drop zone:', { jsonData: !!jsonData })
          if (jsonData) {
            try {
              const track = JSON.parse(jsonData)
              console.log('Adding track to empty queue:', track.name)
              onReorderTracks([track])
            } catch (error) {
              console.error('Fel vid drop av låt:', error)
            }
          }
        }}
          >
            <p className="text-gray-400 mb-2">Inga låtar i kö än.</p>
            <p className="text-sm text-gray-500">Dra låtar från vänster sida hit för att bygga din kö</p>
          </div>
        ) : (
          <div className="space-y-2">
            {playlist.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-3 rounded-lg border transition-all cursor-move ${
                  index === currentTrackIndex
                    ? 'bg-spotify-green/20 border-spotify-green'
                    : draggedIndex === index
                    ? 'bg-gray-700 border-gray-500 opacity-50'
                    : dragOverIndex === index
                    ? 'bg-blue-600/20 border-blue-500'
                    : 'bg-spotify-black border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-gray-400 text-lg cursor-move">⋮⋮</div>
                  {track.album?.images?.[0]?.url && (
                    <img src={track.album.images[0].url} alt={track.name} className="w-10 h-10 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p 
                      className={`font-medium truncate cursor-pointer hover:text-spotify-green transition-colors ${
                        index === currentTrackIndex ? 'text-spotify-green' : 'text-white'
                      }`}
                      onClick={() => {
                        const startTime = getTrackStartTime(track.id)
                        const shouldUseStartTime = getTrackUseStartTime(track.id) && startTime
                        console.log('Playing track:', { 
                          trackName: track.name, 
                          startTime, 
                          shouldUseStartTime,
                          useStartTime: getTrackUseStartTime(track.id)
                        })
                        // Skicka startTime direkt i millisekunder (som handlePlayNext gör)
                        onPlayTrack(track, shouldUseStartTime ? startTime : undefined)
                      }}
                      title="Klicka för att spela"
                    >
                      {track.name}
                    </p>
                    <p className="text-sm text-spotify-light truncate">
                      {track.artists?.[0]?.name || 'Okänd artist'}
                    </p>
                    {startPoints[track.id] && (
                      <div className="flex items-center space-x-2">
                        <p className="text-xs text-spotify-green">
                          Starttid: {Math.floor(startPoints[track.id] / 1000)}s ({startPoints[track.id]} ms)
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleStartTimeUsage(track.id)
                          }}
                          className={`px-1 py-0.5 text-xs rounded ${
                            useStartTimes[track.id] 
                              ? 'bg-spotify-green text-white' 
                              : 'bg-gray-600 text-gray-300'
                          }`}
                          title={useStartTimes[track.id] ? 'Använder starttid - klicka för att spela från början' : 'Spelar från början - klicka för att använda starttid'}
                        >
                          {useStartTimes[track.id] ? '✓' : '○'}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        const startTime = getTrackStartTime(track.id)
                        const shouldUseStartTime = getTrackUseStartTime(track.id) && startTime
                        console.log('Playing track from button:', { 
                          trackName: track.name, 
                          trackId: track.id,
                          startTime, 
                          shouldUseStartTime,
                          useStartTime: getTrackUseStartTime(track.id),
                          allUseStartTimes: useStartTimes
                        })
                        // Skicka startTime direkt i millisekunder (som handlePlayNext gör)
                        onPlayTrack(track, shouldUseStartTime ? startTime : undefined)
                      }}
                      className="px-2 py-1 bg-spotify-green text-white text-xs rounded hover:bg-green-600"
                    >
                      Spela
                    </button>
                    <button
                      onClick={() => handleStartTimeEdit(track.id)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Starttid
                    </button>
                    <button
                      onClick={() => onRemoveTrack(index)}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
                
                {/* Starttid redigering */}
                {editingTrack === track.id && (
                  <div className="mt-3">
                    <StartTimeEditor
                      trackId={track.id}
                      trackName={track.name}
                      duration={track.duration_ms}
                      onSave={handleStartTimeSave}
                      onCancel={handleStartTimeCancel}
                      onPlayTrack={onPlayTrack}
                      track={track}
                      accessToken={accessToken}
                      userId={userId}
                    />
                  </div>
                )}
              </div>
            ))}
            
            {/* Drop zone för att lägga till låtar i slutet */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={(e) => {
                e.preventDefault()
                const jsonData = e.dataTransfer.getData('application/json')
                console.log('End of queue drop zone:', { jsonData: !!jsonData })
                if (jsonData) {
                  try {
                    const track = JSON.parse(jsonData)
                    console.log('Adding track to end via drop zone:', track.name)
                    const newPlaylist = [...playlist, track]
                    onReorderTracks(newPlaylist)
                  } catch (error) {
                    console.error('Fel vid drop av låt:', error)
                  }
                }
              }}
              className="p-4 border-2 border-dashed border-gray-600 rounded-lg text-center hover:border-gray-500 transition-colors"
            >
              <p className="text-gray-400 text-sm">Dra låtar hit för att lägga till i slutet av kön</p>
            </div>
          </div>
        )}
      </div>

      {/* Nuvarande låt och kontroller */}
      <div className="bg-spotify-dark rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Nu spelar</h3>
        {currentTrack ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              {currentTrack?.album?.images?.[0]?.url && (
                <img src={currentTrack.album.images[0].url} alt={currentTrack.name} className="w-16 h-16 rounded" />
              )}
              <div className="flex-1">
                <p className="font-medium text-white">{currentTrack?.name}</p>
                <p className="text-sm text-spotify-light">
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
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #4B5563 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #4B5563 100%)`
                  }}
                />
              </div>
            </div>

            {/* Kontroller */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={onPlayPrevious}
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
                onClick={onPlayNext}
                className="p-2 bg-spotify-dark text-white rounded-full hover:bg-gray-700 border border-gray-600"
                title="Nästa låt"
              >
                NEXT
              </button>
              <button
                onClick={handleNextWithFade}
                className="p-2 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 border border-yellow-700 ml-2 disabled:opacity-50"
                title="Nästa låt med fade"
                disabled={isFading}
              >
                Next with fade
              </button>
            </div>
            {isFading && (
              <div className="w-full mt-2 flex flex-col items-center">
                <div className="w-2/3 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-yellow-400 transition-all"
                    style={{ width: `${Math.round(fadeProgress * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-yellow-300 mt-1">Fadar ut... {Math.round(fadeProgress * 100)}%</span>
              </div>
            )}

            {/* Volym */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-spotify-light">
                {volume === 0 ? '🔇' : volume < 30 ? '🔈' : volume < 70 ? '🔉' : '🔊'}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => {
                  const newVolume = Number(e.target.value)
                  console.log('Volume slider changed:', newVolume)
                  onVolumeChange(newVolume)
                }}
                className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${volume}%, #4B5563 ${volume}%, #4B5563 100%)`
                }}
              />
              <span className="text-xs text-spotify-light w-8">{volume}%</span>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">Ingen låt spelar just nu.</p>
        )}
      </div>
    </div>
  )
} 