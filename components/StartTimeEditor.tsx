'use client'

import { useState, useEffect, useRef } from 'react'

interface StartTimeEditorProps {
  trackId: string
  trackName: string
  duration: number
  onSave: (trackId: string, startTimeMs: number) => void
  onCancel: () => void
  onPlayTrack?: (track: any, startTimeMs?: number) => void
  track?: any
  accessToken?: string | null
  userId?: string | null
}

export default function StartTimeEditor({ 
  trackId, 
  trackName, 
  duration, 
  onSave, 
  onCancel,
  onPlayTrack,
  track,
  accessToken,
  userId
}: StartTimeEditorProps) {
  const [startTimeMs, setStartTimeMs] = useState(0)
  const [startTimeText, setStartTimeText] = useState('')
  const [showSlider, setShowSlider] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Ladda befintlig starttid
  useEffect(() => {
    if (userId) {
      const loadStartTime = async () => {
        try {
          // Försök hämta från servern först
          const res = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
          if (res.ok) {
            const data = await res.json()
            const serverStartPoints = data.startPoints || {}
            const existingTime = serverStartPoints[trackId] || 0
            console.log('Loading start time from server for track:', { trackId, existingTime })
            setStartTimeMs(existingTime)
            setStartTimeText(existingTime.toString())
          }
        } catch (error) {
          console.error('Fel vid laddning av starttid från server:', error)
        }
      }
      loadStartTime()
    }
  }, [trackId, userId])

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleSave = async () => {
    const timeMs = parseInt(startTimeText)
    if (!isNaN(timeMs) && timeMs >= 0 && timeMs <= duration) {
      console.log('Saving start time:', { trackId, timeMs })
      if (userId) {
        // Hämta aktuell kö och useStartTimes/startPoints från servern
        try {
          const resGet = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
          let queues = []
          let useStartTimes = {}
          let startPoints = {}
          if (resGet.ok) {
            const data = await resGet.json()
            queues = data.queues || []
            useStartTimes = { ...(data.useStartTimes || {}), [trackId]: true } // Sätt alltid true när man sparar starttid
            startPoints = { ...(data.startPoints || {}), [trackId]: timeMs }
          } else {
            startPoints = { [trackId]: timeMs }
            useStartTimes = { [trackId]: true }
          }
          await fetch('/api/queues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, queues, startPoints, useStartTimes })
          })
          console.log('Starttid och useStartTimes sparad separat till databasen:', { trackId, timeMs })
        } catch (error) {
          console.error('Fel vid separat sparande av starttid till databasen:', error)
        }
      }
      onSave(trackId, timeMs)
    } else {
      alert('Ange ett giltigt värde mellan 0 och ' + duration + ' millisekunder')
    }
  }

  const handleSliderChange = (value: number) => {
    const timeMs = Math.floor((value / 100) * duration)
    setStartTimeMs(timeMs)
    setStartTimeText(timeMs.toString())
    
    // Spela låten vid ny position med debounce
    if (onPlayTrack && track) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      
      debounceRef.current = setTimeout(() => {
        onPlayTrack(track, timeMs / 1000)
      }, 300)
    }
  }

  const playAtCurrentPosition = () => {
    if (onPlayTrack && track) {
      console.log('Playing at current position:', { trackName: track.name, startTimeMs })
      onPlayTrack(track, startTimeMs / 1000)
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-spotify-dark rounded-lg p-4 border border-spotify-light">
      <h4 className="text-white font-medium mb-3">Justera starttid för "{trackName}"</h4>
      
      <div className="space-y-4">
        {/* Text input */}
        <div>
          <label className="block text-spotify-light text-sm mb-2">
            Starttid (millisekunder)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={startTimeText}
              onChange={(e) => setStartTimeText(e.target.value)}
              placeholder="0"
              min="0"
              max={duration}
              className="flex-1 px-3 py-2 bg-spotify-black text-white text-sm rounded border border-spotify-light"
            />
            <span className="text-spotify-light text-sm self-center">
              ({formatTime(parseInt(startTimeText) || 0)})
            </span>
          </div>
        </div>

        {/* Spela-knapp */}
        <div>
          <button
            onClick={playAtCurrentPosition}
            className="px-3 py-1 bg-spotify-green text-white text-xs rounded hover:bg-green-600"
          >
            ▶️ Spela från {formatTime(startTimeMs)}
          </button>
        </div>

        {/* Slider toggle */}
        <div>
          <button
            onClick={() => setShowSlider(!showSlider)}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            {showSlider ? 'Dölj slider' : 'Visa slider för justering'}
          </button>
        </div>

        {/* Slider */}
        {showSlider && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-spotify-light text-sm">
                Dra för att välja starttid: {formatTime(startTimeMs)}
              </label>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={startTimeMs > 0 ? (startTimeMs / duration) * 100 : 0}
              onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-spotify-black rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-spotify-light">
              <span>0:00</span>
              <span>{formatTime(duration)}</span>
            </div>
            <p className="text-xs text-gray-400">
              💡 Dra i slidern för att justera starttid och spela låten
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-spotify-green text-white text-sm rounded hover:bg-green-600"
          >
            Spara
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
} 