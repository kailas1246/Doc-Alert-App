import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import DocumentList from './components/DocumentList'

const App = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-xl font-bold">Doc Alert</div>
          <div className="flex gap-4">
            <NavLink to="/" end className={({ isActive }) => `text-sm ${isActive ? 'text-blue-600 font-semibold' : 'text-black'}`}>
              Dashboard
            </NavLink>
            <NavLink to="/list" className={({ isActive }) => `text-sm ${isActive ? 'text-blue-600 font-semibold' : 'text-black'}`}>
              All Documents
            </NavLink>
          </div>
        </div>
      </nav>

      <main className="py-6">
        <div className="max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/list" element={<DocumentList />} />
            <Route path="*" element={<div className="p-6 bg-white rounded shadow">Page not found</div>} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
