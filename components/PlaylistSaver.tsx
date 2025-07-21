'use client'

import { useState } from 'react'
import { Track } from '@/types/spotify'

interface PlaylistSaverProps {
  playlist: Track[]
  onSave: () => void
}

export default function PlaylistSaver({ playlist, onSave }: PlaylistSaverProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!playlistName.trim()) {
      alert('Ange ett namn för spellistan')
      return
    }

    if (playlist.length === 0) {
      alert('Ingen spellista att spara')
      return
    }

    setSaving(true)
    try {
      // Hämta befintliga spellistor
      const savedPlaylists = localStorage.getItem('spotifyPlaylists')
      const playlists = savedPlaylists ? JSON.parse(savedPlaylists) : []

      // Skapa ny spellista
      const newPlaylist = {
        id: Date.now().toString(),
        name: playlistName.trim(),
        tracks: playlist,
        savedAt: new Date().toISOString()
      }

      // Lägg till den nya spellistan
      playlists.push(newPlaylist)

      // Spara till localStorage
      localStorage.setItem('spotifyPlaylists', JSON.stringify(playlists))

      alert(`Spellistan "${playlistName}" har sparats!`)
      setShowDialog(false)
      setPlaylistName('')
      onSave()
    } catch (error) {
      console.error('Fel vid sparande av spellista:', error)
      alert('Kunde inte spara spellistan. Försök igen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setShowDialog(true)}
        disabled={playlist.length === 0}
        className="w-full px-4 py-2 bg-spotify-green text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Spara spellista lokalt ({playlist.length} låtar)
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-spotify-dark rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Spara spellista</h3>
            
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">
                Namn på spellistan
              </label>
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Mitt spellistanamn"
                className="w-full px-3 py-2 bg-spotify-black text-white border border-gray-600 rounded-lg focus:outline-none focus:border-spotify-green"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <p className="text-gray-400 text-sm">
                {playlist.length} låtar kommer att sparas lokalt
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !playlistName.trim()}
                className="flex-1 px-4 py-2 bg-spotify-green text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {saving ? 'Sparar...' : 'Spara'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 