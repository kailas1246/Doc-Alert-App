import React, { useEffect, useState } from 'react'
import { getDocs, deleteDoc } from '../lib/storage'

function daysLeft(expiryISO) {
  const now = new Date()
  const exp = new Date(expiryISO + 'T00:00:00')
  const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
  return diff
}

function openGmailCompose(to, subject, body) {
  const base = 'https://mail.google.com/mail/?view=cm&fs=1'
  const url = `${base}&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.open(url, '_blank')
}

const DocumentList = () => {
  const [docs, setDocs] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const d = await getDocs()
      if (mounted) setDocs(d.map(doc => ({ ...doc, id: doc.id || doc._id })))
    }
    load()

    const handler = () => { load() }
    if (typeof window !== 'undefined') window.addEventListener('docs:changed', handler)
    return () => { mounted = false; if (typeof window !== 'undefined') window.removeEventListener('docs:changed', handler) }
  }, [])

  async function removeDoc(id) {
    if (!confirm('Delete this document?')) return
    setDocs(docs.filter(d => String(d.id) !== String(id)))
    try {
      await deleteDoc(id)
    } catch (e) {
      console.error('delete failed', e)
    }
  }

  function sendForDoc(d) {
    // send removed; keep function stub for compatibility
  }

  const q = query.trim().toLowerCase()
  const filtered = docs.filter(d => {
    if (q && !(d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q))) return false
    const dl = daysLeft(d.expiry)
    if (filter === 'expired') return dl < 0
    if (filter === 'active') return dl >= 0
    return true
  })

  return (
    <div className="p-6 bg-white rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">All Documents</h2>
        <div className="flex gap-2 items-center">
          <input className="border rounded px-3 py-2" placeholder="Search by name or type" value={query} onChange={e => setQuery(e.target.value)} />
          <select className="border rounded px-3 py-2" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active (not expired)</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-sm text-gray-600">
            <tr>
              <th className="py-2">Name</th>
              <th>Type</th>
              <th>Expiry</th>
              <th>Days</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const dl = daysLeft(d.expiry)
              const isExpired = dl < 0
              const isSoon = dl >= 0 && dl <= 5
              return (
                <tr key={d.id} className={`border-t ${isExpired ? 'bg-red-50' : isSoon ? 'bg-yellow-50' : ''}`}>
                  <td className="py-3">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-gray-500">{d.email}</div>
                  </td>
                  <td>{d.type}</td>
                  <td>{d.expiry}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-sm ${isExpired ? 'bg-red-200 text-red-800' : isSoon ? 'bg-yellow-200 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {isExpired ? 'Expired' : `${dl} day${dl === 1 ? '' : 's'}`}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 border rounded" onClick={() => removeDoc(d.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-500">No documents found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DocumentList
