'use client'

import { useState } from 'react'
import { Track } from '@/types/spotify'

interface TrackListProps {
  tracks: Track[]
  onAddToPlaylist: (track: Track) => void
  onPlayTrack?: (track: Track, startTimeMs?: number) => void
  isLoading?: boolean
  title?: string
  onDragStart?: (track: Track) => void
}

export default function TrackList({ tracks, onAddToPlaylist, onPlayTrack, isLoading = false, title = "Sökresultat", onDragStart }: TrackListProps) {
  const handleDragStart = (e: React.DragEvent, track: Track) => {
    e.dataTransfer.setData('application/json', JSON.stringify(track))
    e.dataTransfer.effectAllowed = 'copy'
    if (onDragStart) {
      onDragStart(track)
    }
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="bg-spotify-dark rounded-lg p-3 lg:p-6">
        <h2 className="text-lg lg:text-xl font-semibold text-white mb-3 lg:mb-4">{title}</h2>
        <div className="text-center py-6 lg:py-8">
          <div className="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-spotify-green mx-auto"></div>
          <p className="text-spotify-light mt-2 text-sm lg:text-base">Söker...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-spotify-dark rounded-lg p-3 lg:p-6">
      <h2 className="text-lg lg:text-xl font-semibold text-white mb-3 lg:mb-4">
        {title} ({tracks.length})
      </h2>
      
      {tracks.length === 0 ? (
        <p className="text-spotify-light text-center py-6 lg:py-8 text-sm lg:text-base">
          Sök efter låtar för att se resultat
        </p>
      ) : (
        <div className="space-y-2 lg:space-y-3">
          {tracks.map((track) => (
            <div 
              key={track.id} 
              className="bg-spotify-black rounded-lg p-3 lg:p-4 cursor-grab active:cursor-grabbing hover:bg-gray-800 transition-colors"
              draggable
              onDragStart={(e) => handleDragStart(e, track)}
            >
              <div className="flex items-center gap-3 lg:gap-4">
                <img
                  src={track.album.images[0]?.url || '/placeholder-album.png'}
                  alt={track.album.name}
                  className="w-10 h-10 lg:w-12 lg:h-12 rounded"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-sm lg:text-base truncate">{track.name}</h3>
                  <p className="text-spotify-light text-xs lg:text-sm truncate">
                    {track.artists.map(a => a.name).join(', ')}
                  </p>
                  <p className="text-spotify-light text-xs truncate">{track.album.name}</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-spotify-light text-xs lg:text-sm">
                    {formatDuration(track.duration_ms)}
                  </p>
                  <div className="flex flex-col space-y-1 mt-2">
                    {onPlayTrack && (
                      <button
                        onClick={() => onPlayTrack(track)}
                        className="px-2 py-1 lg:px-3 lg:py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                      >
                        Spela
                      </button>
                    )}
                    <button
                      onClick={() => onAddToPlaylist(track)}
                      className="px-2 py-1 lg:px-3 lg:py-1 bg-spotify-green text-white text-xs rounded hover:bg-green-600 transition-colors"
                    >
                      Lägg till
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 