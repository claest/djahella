'use client'

import { useState, useEffect, useRef } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  isLoading: boolean
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastSearchedQuery = useRef<string>('')

  // Debounced search effect
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Bara sök om query är minst 2 tecken och inte redan sökt
    if (query.trim().length >= 2 && query.trim() !== lastSearchedQuery.current) {
      timeoutRef.current = setTimeout(() => {
        setDebouncedQuery(query)
      }, 600) // Öka till 600ms för ännu mindre hopp
    } else if (!query.trim()) {
      setDebouncedQuery('')
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [query])

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim() && debouncedQuery.trim() !== lastSearchedQuery.current) {
      lastSearchedQuery.current = debouncedQuery.trim()
      onSearch(debouncedQuery)
    }
  }, [debouncedQuery, onSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      lastSearchedQuery.current = query.trim()
      onSearch(query)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    
    // Om användaren rensar fältet helt, rensa också debounced query
    if (!newQuery.trim()) {
      setDebouncedQuery('')
      lastSearchedQuery.current = ''
    }
  }

  return (
    <div className="bg-spotify-dark rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Sök låtar</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Sök efter låtar, artister eller album..."
            className="flex-1 px-4 py-2 bg-spotify-black text-white rounded-lg border border-spotify-light focus:border-spotify-green focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-6 py-2 bg-spotify-green text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Söker...' : 'Sök'}
          </button>
        </div>
      </form>
      {isLoading && (
        <div className="mt-2 text-center">
          <div className="inline-flex items-center text-spotify-light text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-spotify-green mr-2"></div>
            Söker...
          </div>
        </div>
      )}
      {query && query.length < 2 && !isLoading && (
        <div className="mt-2 text-center">
          <p className="text-spotify-light text-sm">
            Skriv minst 2 tecken för att söka...
          </p>
        </div>
      )}
      {query && query.length >= 2 && !isLoading && (
        <div className="mt-2 text-center">
          <p className="text-spotify-light text-sm">
            Söker automatiskt om 600ms...
          </p>
        </div>
      )}
    </div>
  )
} 