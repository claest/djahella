'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Track } from '@/types/spotify'
import StartTimeEditor from './StartTimeEditor'
import SpotifyPlayer from './SpotifyPlayer'

interface QueueManagerProps {
  playlist: Track[]
  onRemoveTrack: (index: number) => void
  onPlayTrack: (track: Track, startTimeMs?: number) => void
  onReorderTracks: (tracks: Track[]) => void
  onClearQueue: () => void
  accessToken?: string | null
  userId?: string | null
  useStartTimes?: { [key: string]: boolean }
  setUseStartTimes?: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>
  startPoints?: { [key: string]: number }
  fadeInSettings?: { [key: string]: boolean }
  onToggleFadeIn?: (trackId: string) => void
  currentTrack?: any
  // Spotify Player props
  isPlaying?: boolean
  currentTime?: number
  duration?: number
  volume?: number
  isShuffled?: boolean
  isPlayerReady?: boolean
  onPlayNext?: () => void
  onPlayPrevious?: () => void
  onTogglePlay?: () => void
  onVolumeChange?: (volume: number) => void
  onSeek?: (positionMs: number) => void
  onShuffle?: () => void
  isPlayerMinimized?: boolean
  onToggleMinimize?: () => void
}

const QueueManager = React.memo(function QueueManager({
  playlist,
  onRemoveTrack,
  onPlayTrack,
  onReorderTracks,
  onClearQueue,
  accessToken,
  userId,
  useStartTimes: externalUseStartTimes,
  setUseStartTimes: externalSetUseStartTimes,
  startPoints = {},
  fadeInSettings: externalFadeInSettings,
  onToggleFadeIn: externalOnToggleFadeIn,
  currentTrack,
  // Spotify Player props
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
  isPlayerMinimized,
  onToggleMinimize
}: QueueManagerProps) {

  const [editingTrack, setEditingTrack] = useState<string | null>(null)
  const [internalUseStartTimes, setInternalUseStartTimes] = useState<{ [key: string]: boolean }>({})
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // console.log('QueueManager render:', {
  //   playlistLength: playlist.length,
  //   trackNames: playlist.map(t => t.name)
  // })

  // Använd externa useStartTimes om de finns, annars interna
  const useStartTimes = externalUseStartTimes || internalUseStartTimes
  const setUseStartTimes = externalSetUseStartTimes || setInternalUseStartTimes

  // Spara starttider till servern
  const saveStartTimes = useCallback(async (newStartTimes: { [key: string]: number }) => {
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
        
        // Ta bort useStartTimes för låtar som inte längre har starttider
        const removedTrackIds = Object.keys(data.startPoints || {}).filter(
          trackId => !newStartTimes.hasOwnProperty(trackId)
        )
        removedTrackIds.forEach(trackId => {
          delete useStartTimesToSend[trackId]
        })
      }

      // Skicka till servern
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          queues,
          startPoints: newStartTimes,
          useStartTimes: useStartTimesToSend,
          fadeInSettings: externalFadeInSettings || {}
        })
      })

      if (!res.ok) {
        throw new Error('Kunde inte spara starttider')
      }
    } catch (error) {
      console.error('Fel vid sparande av starttider:', error)
    }
  }, [userId, useStartTimes, externalFadeInSettings])

  const handleStartTimeEdit = useCallback((trackId: string) => {
    setEditingTrack(trackId)
  }, [])

  const handleStartTimeSave = useCallback(async (trackId: string, startTimeMs: number) => {
    try {
      let newStartPoints
      if (startTimeMs === 0) {
        // Ta bort starttid från lokalt state om 0
        const { [trackId]: removed, ...remaining } = startPoints
        newStartPoints = remaining
        console.log('Starttid borttagen för låt:', trackId)
      } else {
        // Spara starttid
        newStartPoints = { ...startPoints, [trackId]: startTimeMs }
        console.log('Starttid sparad för låt:', trackId, startTimeMs)
      }
      
      const saveToDatabase = async () => {
        await saveStartTimes(newStartPoints)
      }
      
      await saveToDatabase()
      setEditingTrack(null)
    } catch (error) {
      console.error('Fel vid sparande av starttid:', error)
    }
  }, [startPoints, saveStartTimes])

  const handleStartTimeCancel = useCallback(() => {
    setEditingTrack(null)
  }, [])

  const toggleStartTimeUsage = useCallback(async (trackId: string) => {
    try {
      const newUseStartTimes = {
        ...useStartTimes,
        [trackId]: !useStartTimes[trackId]
      }
      
      setUseStartTimes(newUseStartTimes)
      
      // Spara till servern
      if (userId) {
        const resGet = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
        let queues = []
        if (resGet.ok) {
          const data = await resGet.json()
          queues = data.queues || []
        }

        await fetch('/api/queues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            queues,
            startPoints,
            useStartTimes: newUseStartTimes,
            fadeInSettings: externalFadeInSettings || {}
          })
        })
      }
    } catch (error) {
      console.error('Fel vid växling av starttid:', error)
    }
  }, [useStartTimes, setUseStartTimes, userId, startPoints, externalFadeInSettings])

  // Drag and drop funktioner
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }, [draggedIndex])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const newPlaylist = [...playlist]
      const [draggedTrack] = newPlaylist.splice(draggedIndex, 1)
      newPlaylist.splice(dropIndex, 0, draggedTrack)
      onReorderTracks(newPlaylist)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [draggedIndex, playlist, onReorderTracks])

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [])

  const formatDuration = useCallback((ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  // Hjälpfunktioner för att hämta inställningar
  const getTrackStartTime = useCallback((trackId: string) => startPoints[trackId] || 0, [startPoints]);
  const getTrackUseStartTime = useCallback((trackId: string) => useStartTimes[trackId] || false, [useStartTimes]);
  const getTrackFadeIn = useCallback((trackId: string) => externalFadeInSettings?.[trackId] || false, [externalFadeInSettings]);

  return (
    <div className="h-full flex flex-col">
      {/* Kö */}
      <div 
        className="flex-1 overflow-y-auto mb-4 lg:mb-6 pb-20 lg:pb-8"
        onDragOver={(e) => {
          e.preventDefault()
        }}
      >
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
              className={`bg-spotify-dark rounded-lg p-3 lg:p-4 border transition-all cursor-move ${
                draggedIndex === index ? 'opacity-50' : ''
              } ${
                dragOverIndex === index ? 'border-spotify-green bg-gray-800' : 
                currentTrack?.id === track.id ? 'border-spotify-green bg-spotify-green bg-opacity-10' :
                'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {/* Drag handle */}
                  <div className="text-gray-500 hover:text-gray-300 cursor-move">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                    </svg>
                  </div>

                  {/* Album cover */}
                  {track.album?.images?.[0]?.url && (
                    <img 
                      src={track.album.images[0].url} 
                      alt={track.name} 
                      className="w-12 h-12 lg:w-14 lg:h-14 rounded flex-shrink-0"
                    />
                  )}

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-white text-sm lg:text-base truncate">{track.name}</p>
                      {currentTrack?.id === track.id && (
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-spotify-green rounded-full animate-pulse"></div>
                          <span className="text-spotify-green text-xs font-medium">SPELAR</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs lg:text-sm text-spotify-light truncate">
                      {track.artists?.map(artist => artist.name).join(', ') || 'Okänd artist'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDuration(track.duration_ms)} • {track.album?.name || 'Okänt album'}
                      {getTrackUseStartTime(track.id) && getTrackStartTime(track.id) > 0 && (
                        <span className="text-yellow-400 ml-2">
                          • Startar vid {formatDuration(getTrackStartTime(track.id))}
                        </span>
                      )}
                      {getTrackFadeIn(track.id) && (
                        <span className="text-blue-400 ml-2">
                          • Fade-in aktiverat
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center space-x-2 ml-3">
                  {/* Start time toggle */}
                  <button
                    onClick={() => toggleStartTimeUsage(track.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      getTrackUseStartTime(track.id) 
                        ? 'bg-spotify-green text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={getTrackUseStartTime(track.id) ? 'Starttid aktiverad' : 'Starttid inaktiverad'}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </button>

                  {/* Edit start time button */}
                  {getTrackUseStartTime(track.id) && (
                    <button
                      onClick={() => handleStartTimeEdit(track.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        editingTrack === track.id
                          ? 'bg-yellow-600 text-white'
                          : 'bg-yellow-700 text-white hover:bg-yellow-600'
                      }`}
                      title="Redigera starttid"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                  )}

                  {/* Fade-in toggle */}
                  <button
                    onClick={() => externalOnToggleFadeIn?.(track.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      getTrackFadeIn(track.id) 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={getTrackFadeIn(track.id) ? 'Fade-in aktiverat' : 'Fade-in inaktiverat'}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </button>

                  {/* Play button */}
                  <button
                    onClick={() => {
                      const shouldUseStartTime = getTrackUseStartTime(track.id) && getTrackStartTime(track.id) > 0
                      const startTimeMs = shouldUseStartTime ? getTrackStartTime(track.id) : undefined
                      onPlayTrack(track, startTimeMs)
                    }}
                    className="p-2 bg-spotify-green text-white rounded-lg hover:bg-green-600 transition-colors"
                    title="Spela låt"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>

                  {/* Remove button */}
                  <button
                    onClick={() => onRemoveTrack(index)}
                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    title="Ta bort från kö"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Start time editor - separat sektion */}
              {getTrackUseStartTime(track.id) && editingTrack === track.id && (
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
        </div>

        {playlist.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">Ingen musik i kö</p>
            <p className="text-sm text-gray-500 mt-2">Sök efter låtar och lägg till dem i kö</p>
          </div>
        )}
      </div>



      {/* Spotify Player - Endast synlig på desktop */}
      <div className="hidden lg:block">
        <SpotifyPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying || false}
          currentTime={currentTime || 0}
          duration={duration || 0}
          volume={volume || 50}
          isShuffled={isShuffled || false}
          isPlayerReady={isPlayerReady || false}
          onPlayNext={onPlayNext || (() => {})}
          onPlayPrevious={onPlayPrevious || (() => {})}
          onTogglePlay={onTogglePlay || (() => {})}
          onVolumeChange={onVolumeChange || (() => {})}
          onSeek={onSeek || (() => {})}
          onShuffle={onShuffle || (() => {})}
          isMinimized={isPlayerMinimized || false}
          onToggleMinimize={onToggleMinimize || (() => {})}
          playlist={playlist}
          fadeInSettings={externalFadeInSettings}
          onPlayTrack={onPlayTrack}
          startPoints={startPoints}
          useStartTimes={externalUseStartTimes}
        />
      </div>
    </div>
  )
})

export default QueueManager