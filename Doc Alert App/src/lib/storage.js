const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'

// fallback to localStorage if API unavailable
const STORAGE_KEY = 'docAlert_docs'

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error('readLocal error', e)
    return []
  }
}

function writeLocal(docs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
  } catch (e) {
    console.error('writeLocal error', e)
  }
}

export async function getDocs() {
  try {
    const res = await fetch(`${API_BASE}/docs`)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (e) {
    return readLocal()
  }
}

export async function addDoc(doc) {
  try {
    const res = await fetch(`${API_BASE}/docs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc)
    })
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    // notify other windows/components
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('docs:changed'))
    return data
  } catch (e) {
    const local = readLocal()
    const id = local.length ? Math.max(...local.map(d => d.id || 0)) + 1 : 1
    const newDoc = { id, ...doc }
    local.unshift(newDoc)
    writeLocal(local)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('docs:changed'))
    return newDoc
  }
}

export async function updateDoc(id, doc) {
  try {
    const res = await fetch(`${API_BASE}/docs/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc)
    })
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('docs:changed'))
    return data
  } catch (e) {
    const local = readLocal()
    const updated = local.map(d => (d.id === id ? { ...d, ...doc } : d))
    writeLocal(updated)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('docs:changed'))
    return updated.find(d => d.id === id)
  }
}

export async function deleteDoc(id) {
  try {
    const res = await fetch(`${API_BASE}/docs/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('API error')
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('docs:changed'))
    return true
  } catch (e) {
    const local = readLocal().filter(d => d.id !== id)
    writeLocal(local)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('docs:changed'))
    return true
  }
}

export default { getDocs, addDoc, updateDoc, deleteDoc }
