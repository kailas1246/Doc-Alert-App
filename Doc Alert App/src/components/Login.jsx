import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Login = ({ onLogin }) => {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    // credentials expected: id = adim123, password = adim123
    if (user === 'Qcrete@gamil.com' && pass === 'Qcrete123') {
      localStorage.setItem('docAlert_auth', '1')
      onLogin && onLogin()
      navigate('/')
    } else {
      setError('Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Sign In</h2>
        {error && <div className="mb-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm mb-1">User ID</label>
            <input className="w-full border rounded px-3 py-2" value={user} onChange={e => setUser(e.target.value)} autoFocus />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-1">Password</label>
            <input type="password" className="w-full border rounded px-3 py-2" value={pass} onChange={e => setPass(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Sign In</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
