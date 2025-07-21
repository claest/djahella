'use client'

import { useState, useEffect, useRef } from 'react'
import { Track } from '@/types/spotify'
import StartTimeEditor from './StartTimeEditor'

interface PlaylistViewerProps {
  playlist: Track[]
  onRemoveTrack: (index: number) => void
  onPlayTrack: (track: Track, startTimeMs?: number) => void
  accessToken?: string | null
  userId: string // Ny prop
  onAddAllToQueue: (tracks: Track[]) => void // Ny prop
}

export default function PlaylistViewer({ playlist, onRemoveTrack, onPlayTrack, accessToken, userId, onAddAllToQueue }: PlaylistViewerProps) {
  const [editingTrack, setEditingTrack] = useState<string | null>(null)
  const [startTimes, setStartTimes] = useState<{ [key: string]: number }>({})
  const [useStartTimes, setUseStartTimes] = useState<{ [key: string]: boolean }>({})
  const trackRefs = useRef<{ [key: string]: HTMLDivElement }>({})

  // Ladda sparade starttider från localStorage
  useEffect(() => {
    if (userId) {
      try {
        const saved = localStorage.getItem(`trackStartTimes_${userId}`)
        if (saved) {
          const times = JSON.parse(saved)
          setStartTimes(times)
          console.log('PlaylistViewer loaded start times:', times)
          
          // Ladda också useStartTimes-inställningar
          const savedUseStartTimes = localStorage.getItem(`useStartTimes_${userId}`)
          if (savedUseStartTimes) {
            const useStartTimesData = JSON.parse(savedUseStartTimes)
            setUseStartTimes(useStartTimesData)
            console.log('PlaylistViewer loaded use start times settings:', useStartTimesData)
          } else {
            // Om inga sparade inställningar finns, sätt alla låtar med starttid till att använda den som standard
            const defaultUseStartTimes: { [key: string]: boolean } = {}
            Object.keys(times).forEach(trackId => {
              defaultUseStartTimes[trackId] = true
            })
            setUseStartTimes(defaultUseStartTimes)
            console.log('PlaylistViewer set default use start times:', defaultUseStartTimes)
          }
        }
      } catch (error) {
        console.error('Fel vid laddning av starttider:', error)
      }
    }
  }, [userId])

  // Spara starttider till localStorage
  const saveStartTimes = (newStartTimes: { [key: string]: number }) => {
    if (accessToken) {
      try {
        localStorage.setItem(`trackStartTimes_${accessToken}`, JSON.stringify(newStartTimes))
      } catch (error) {
        console.error('Fel vid sparande av starttider:', error)
      }
    }
  }

  const handleDragStart = (e: React.DragEvent, track: Track) => {
    e.dataTransfer.setData('application/json', JSON.stringify(track))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleStartTimeEdit = (trackId: string) => {
    setEditingTrack(trackId)
    // Scrolla till låten
    if (trackRefs.current[trackId]) {
      trackRefs.current[trackId].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
    }
  }

  const handleStartTimeSave = (trackId: string, startTimeMs: number) => {
    const newStartTimes = { ...startTimes, [trackId]: startTimeMs }
    setStartTimes(newStartTimes)
    saveStartTimes(newStartTimes)
    
    // Automatiskt sätta useStartTimes till true för denna låt
    setUseStartTimes(prev => {
      const newUseStartTimes = { ...prev, [trackId]: true }
      if (accessToken) {
        try {
          localStorage.setItem(`useStartTimes_${accessToken}`, JSON.stringify(newUseStartTimes))
        } catch (error) {
          console.error('Fel vid sparande av useStartTimes:', error)
        }
      }
      console.log('PlaylistViewer auto-set useStartTimes to true for track:', trackId)
      return newUseStartTimes
    })
    
    setEditingTrack(null)
  }

  const handleStartTimeCancel = () => {
    setEditingTrack(null)
  }

  const toggleStartTimeUsage = (trackId: string) => {
    setUseStartTimes(prev => {
      const newUseStartTimes = {
        ...prev,
        [trackId]: !prev[trackId]
      }
      
      // Spara till localStorage
      if (accessToken) {
        try {
          localStorage.setItem(`useStartTimes_${accessToken}`, JSON.stringify(newUseStartTimes))
        } catch (error) {
          console.error('Fel vid sparande av useStartTimes:', error)
        }
      }
      
      console.log('PlaylistViewer toggled start time usage for track:', trackId, 'New state:', newUseStartTimes[trackId])
      return newUseStartTimes
    })
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-spotify-dark rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Spellista ({playlist.length} låtar)
      </h2>
      {playlist.length > 0 && (
        <div className="flex justify-end mb-2 gap-2">
          <button
            onClick={() => onAddAllToQueue(playlist)}
            className="px-3 py-1 bg-spotify-green text-white text-sm rounded hover:bg-green-600"
          >
            Lägg till alla i kö
          </button>
        </div>
      )}
      
      {playlist.length === 0 ? (
        <p className="text-spotify-light text-center py-8">
          Ingen spellista laddad
        </p>
      ) : (
        <div className="space-y-3">
          {playlist.map((track: Track, index: number) => (
            <div 
              key={track.id} 
              ref={el => { if (el) trackRefs.current[track.id] = el }}
              className="bg-spotify-black rounded-lg p-4 cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => handleDragStart(e, track)}
            >
              <div className="flex items-center gap-4">
                <img
                  src={track.album.images[0]?.url || '/placeholder-album.png'}
                  alt={track.album.name}
                  className="w-12 h-12 rounded"
                />
                <div className="flex-1">
                  <h3 className="text-white font-medium">{track.name}</h3>
                  <p className="text-spotify-light text-sm">
                    {track.artists?.map((a: any) => a.name).join(', ') || 'Okänd artist'}
                  </p>
                  <p className="text-spotify-light text-xs">{track.album.name}</p>
                  {startTimes[track.id] && (
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-xs text-spotify-green">
                        Starttid: {Math.floor(startTimes[track.id] / 1000)}s ({startTimes[track.id]} ms)
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
                <div className="text-right">
                  <p className="text-spotify-light text-sm">
                    {formatDuration(track.duration_ms)}
                  </p>
                  <div className="flex flex-col space-y-1 mt-1">
                    <button
                      onClick={() => {
                        const startTime = startTimes[track.id]
                        const shouldUseStartTime = useStartTimes[track.id] && startTime
                        console.log('PlaylistViewer playing track:', { 
                          trackName: track.name, 
                          startTime, 
                          shouldUseStartTime,
                          useStartTime: useStartTimes[track.id]
                        })
                        onPlayTrack(track, shouldUseStartTime ? startTime / 1000 : undefined)
                      }}
                      className="px-2 py-1 bg-spotify-green text-white text-xs rounded hover:bg-green-600"
                    >
                      Spela
                    </button>
                    <button
                      onClick={() => handleStartTimeEdit(track.id)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Justera starttid
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Starttid redigering */}
              {editingTrack === track.id && (
                <div className="mt-4">
                  <StartTimeEditor
                    trackId={track.id}
                    trackName={track.name}
                    duration={track.duration_ms}
                    onSave={handleStartTimeSave}
                    onCancel={handleStartTimeCancel}
                    onPlayTrack={onPlayTrack}
                    track={track}
                    accessToken={accessToken}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 