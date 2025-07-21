import React, { useState, useEffect } from 'react'
import { Track } from '../types/spotify'

interface QueueSaverProps {
  playlist: Track[]
  accessToken: string | null
  userId: string | null
  onLoadQueue: (tracks: Track[], name: string) => void
}

interface SavedQueue {
  id: string
  userId: string
  name: string
  tracks: Track[]
  createdAt: string
  updatedAt: string
}

export default function QueueSaver({ playlist, accessToken, userId, onLoadQueue }: QueueSaverProps) {
  const [savedQueues, setSavedQueues] = useState<SavedQueue[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Ny: Hämta köer från servern
  const fetchQueuesFromServer = async (userId: string): Promise<SavedQueue[]> => {
    try {
      const res = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.queues || []
    } catch (error) {
      console.error('Fel vid hämtning av köer från servern:', error)
      return []
    }
  }

  // Modifierad: Ladda sparade köer när komponenten mountas
  useEffect(() => {
    if (accessToken && userId) {
      (async () => {
        // 1. Försök hämta från servern
        const serverQueues = await fetchQueuesFromServer(userId)
        if (serverQueues.length > 0) {
          setSavedQueues(serverQueues)
        } else {
          // 2. Om servern är tom, hämta från localStorage
          loadSavedQueues()
        }
      })()
    }
  }, [accessToken, userId])

  const loadSavedQueues = () => {
    if (!userId) return

    try {
      const stored = localStorage.getItem(`spotify_queues_${userId}`)
      const queues = stored ? JSON.parse(stored) : []
      setSavedQueues(queues)
    } catch (error) {
      console.error('Fel vid laddning av sparade köer:', error)
      setSavedQueues([])
    }
  }

  // Ny: Spara köer till servern
  const saveQueuesToServer = async (queues: SavedQueue[]) => {
    if (!userId) return
    try {
      // Hämta befintliga starttider och useStartTimes från servern först
      const res = await fetch(`/api/queues?userId=${encodeURIComponent(userId)}`)
      let existingStartPoints = {}
      let existingUseStartTimes = {}
      
      if (res.ok) {
        const data = await res.json()
        existingStartPoints = data.startPoints || {}
        existingUseStartTimes = data.useStartTimes || {}
      }
      
      await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          queues, 
          startPoints: existingStartPoints,
          useStartTimes: existingUseStartTimes
        })
      })
      console.log('Köer sparade till servern med befintliga starttider:', existingStartPoints)
    } catch (error) {
      console.error('Fel vid sparande av köer till servern:', error)
    }
  }

  // Modifierad: Spara köer till både localStorage och server
  const saveQueuesToStorage = async (queues: SavedQueue[]) => {
    if (!userId) return
    try {
      localStorage.setItem(`spotify_queues_${userId}`, JSON.stringify(queues))
      await saveQueuesToServer(queues)
    } catch (error) {
      console.error('Fel vid sparande av köer:', error)
    }
  }

  const handleSaveQueue = async () => {
    if (!userId || !saveName.trim() || playlist.length === 0) return

    setIsLoading(true)
    try {
      const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()
      
      const newQueue: SavedQueue = {
        id,
        userId: userId,
        name: saveName.trim(),
        tracks: playlist,
        createdAt: now,
        updatedAt: now
      }
      
      const updatedQueues = [...savedQueues, newQueue]
      setSavedQueues(updatedQueues)
      await saveQueuesToStorage(updatedQueues)
      
      setSaveName('')
      setShowSaveDialog(false)
      console.log('Kö sparad:', newQueue.name)
    } catch (error) {
      console.error('Fel vid sparande av kö:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadQueue = (queueId: string) => {
    const queue = savedQueues.find(q => q.id === queueId)
    if (queue) {
      onLoadQueue(queue.tracks, queue.name)
      console.log('Kö laddad:', queue.name)
    }
  }

  const handleDeleteQueue = async (queueId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna kö?')) return

    try {
      const updatedQueues = savedQueues.filter(q => q.id !== queueId)
      setSavedQueues(updatedQueues)
      await saveQueuesToStorage(updatedQueues)
      console.log('Kö borttagen')
    } catch (error) {
      console.error('Fel vid borttagning av kö:', error)
    }
  }

  const handleEditQueue = async (queueId: string) => {
    if (!editName.trim()) return

    try {
      const updatedQueues = savedQueues.map(q => 
        q.id === queueId 
          ? { ...q, name: editName.trim(), updatedAt: new Date().toISOString() }
          : q
      )
      setSavedQueues(updatedQueues)
      await saveQueuesToStorage(updatedQueues)
      setEditingQueueId(null)
      setEditName('')
      console.log('Kö redigerad')
    } catch (error) {
      console.error('Fel vid redigering av kö:', error)
    }
  }

  const startEditing = (queue: SavedQueue) => {
    setEditingQueueId(queue.id)
    setEditName(queue.name)
  }

  const cancelEditing = () => {
    setEditingQueueId(null)
    setEditName('')
  }

  return (
    <div className="space-y-4">
      {/* Spara kö knapp */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setShowSaveDialog(true)}
          disabled={playlist.length === 0 || isLoading}
          className="px-4 py-2 bg-spotify-green text-black font-medium rounded hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Spara kö ({playlist.length} låtar)
        </button>
      </div>
      {/* Spara dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-spotify-dark p-6 rounded-lg w-96">
            <h3 className="text-xl font-bold text-white mb-4">Spara kö</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ange namn för köen"
              className="w-full p-2 bg-spotify-black text-white border border-gray-600 rounded mb-4"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleSaveQueue}
                disabled={!saveName.trim() || isLoading}
                className="px-4 py-2 bg-spotify-green text-black font-medium rounded hover:bg-green-400 disabled:opacity-50"
              >
                {isLoading ? 'Sparar...' : 'Spara'}
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setSaveName('')
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sparade köer */}
      <div>
        <div className="space-y-2">
          {savedQueues.map((queue) => (
            <div key={queue.id} className="bg-spotify-black p-3 rounded border border-gray-700">
              {editingQueueId === queue.id ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 p-1 bg-spotify-dark text-white border border-gray-600 rounded text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => handleEditQueue(queue.id)}
                    className="px-2 py-1 bg-spotify-green text-black text-xs rounded hover:bg-green-400"
                  >
                    Spara
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                  >
                    Avbryt
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium">{queue.name}</p>
                    <p className="text-sm text-gray-400">
                      {queue.tracks.length} låtar • {new Date(queue.updatedAt).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleLoadQueue(queue.id)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      title="Ladda kö"
                    >
                      Ladda
                    </button>
                    <button
                      onClick={() => startEditing(queue)}
                      className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                      title="Byt namn"
                    >
                      Redigera
                    </button>
                    <button
                      onClick={() => handleDeleteQueue(queue.id)}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      title="Ta bort"
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 