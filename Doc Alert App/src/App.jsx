import React, { useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import DocumentList from './components/DocumentList'
import Login from './components/Login'

const App = () => {
  const [isAuth, setIsAuth] = useState(Boolean(localStorage.getItem('docAlert_auth')))
  const navigate = useNavigate()

  function handleLogout() {
    localStorage.removeItem('docAlert_auth')
    setIsAuth(false)
    navigate('/login')
  }

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
            {isAuth ? (
              <button onClick={handleLogout} className="text-sm text-red-600">Logout</button>
            ) : (
              <NavLink to="/login" className={({ isActive }) => `text-sm ${isActive ? 'text-blue-600 font-semibold' : 'text-black'}`}>
                Login
              </NavLink>
            )}
          </div>
        </div>
      </nav>

      <main className="py-6">
        <div className="max-w-6xl mx-auto">
          <Routes>
            <Route path="/login" element={<Login onLogin={() => setIsAuth(true)} />} />
            <Route path="/" element={isAuth ? <Dashboard /> : <Navigate to="/login" replace />} />
            <Route path="/list" element={isAuth ? <DocumentList /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<div className="p-6 bg-white rounded shadow">Page not found</div>} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
