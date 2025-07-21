'use client'

import { useState } from 'react'

export default function MigratePage() {
  const [userId, setUserId] = useState('ahellafrikidiki')
  const [result, setResult] = useState('')

  const migrateData = async () => {
    try {
      // Hämta data från localStorage
      const localStorageQueues = localStorage.getItem(`spotify_queues_${userId}`)
      const localStorageStartPoints = localStorage.getItem(`trackStartTimes_${userId}`)
      const localStorageUseStartTimes = localStorage.getItem(`useStartTimes_${userId}`)
      
      let queues = []
      let startPoints = {}
      let useStartTimes = {}
      
      if (localStorageQueues) {
        queues = JSON.parse(localStorageQueues)
      }
      if (localStorageStartPoints) {
        startPoints = JSON.parse(localStorageStartPoints)
      }
      if (localStorageUseStartTimes) {
        useStartTimes = JSON.parse(localStorageUseStartTimes)
      }
      
      console.log('Data från localStorage:', { queues, startPoints, useStartTimes })
      
      // Skicka till API
      const response = await fetch('/api/migrate-localstorage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, queues, startPoints, useStartTimes })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setResult(`✅ Migrering lyckades! ${queues.length} köer migrerade.`)
        console.log('Migrering lyckades:', data)
      } else {
        setResult(`❌ Migrering misslyckades: ${data.error}`)
        console.error('Migrering misslyckades:', data)
      }
      
    } catch (error) {
      setResult(`❌ Fel: ${error}`)
      console.error('Fel vid migrering:', error)
    }
  }

  return (
    <div className="min-h-screen bg-spotify-dark text-white p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Migrera localStorage-data</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Användar-ID:</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full p-2 bg-spotify-black border border-gray-600 rounded"
            />
          </div>
          
          <button
            onClick={migrateData}
            className="w-full px-4 py-2 bg-spotify-green text-black font-medium rounded hover:bg-green-400"
          >
            Migrera data
          </button>
          
          {result && (
            <div className="mt-4 p-3 bg-spotify-black rounded border">
              {result}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 