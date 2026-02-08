import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import DevelopmentEnvironment from './components/DevelopmentEnvironment'
import { Button } from './components/ui/button'

function App() {
  return (
    <Router>
      <div className="min-h-screen p-6">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Car Listings — There were 426,804 listings and 276,628 cars</h1>
            <Link to="/dev">
              <Button variant="outline" size="sm">
                Development Environment
              </Button>
            </Link>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dev" element={<DevelopmentEnvironment />} />
        </Routes>

        <footer className="mt-6 text-sm text-gray-500 text-center">
          Frontend: frontend-dev-{import.meta.env.VITE_VERSION || 'dev'} | Backend: backend-dev-{import.meta.env.VITE_VERSION || 'dev'}
        </footer>
      </div>
    </Router>
  )
}

export default App
