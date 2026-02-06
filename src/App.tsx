import React from 'react'
import Dashboard from './components/Dashboard'

export default function App() {
  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Car Listings — There were 426,804 listings and 276,628 cars</h1>
      </header>
      <Dashboard />
    </div>
  )
}
