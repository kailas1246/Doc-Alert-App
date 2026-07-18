import React, { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import { getDocs, addDoc, updateDoc, deleteDoc } from '../lib/storage'
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'
import EmailModal from './EmailModal'

function daysLeft(expiryISO) {
  const now = new Date()
  const exp = new Date(expiryISO + 'T00:00:00')
  const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
  return diff
}

const Dashboard = () => {
  const [docs, setDocs] = useState([])
  const [form, setForm] = useState({
    name: "",
    type: "Other",
    expiry: "",
    alertDaysBefore: 5,
    alertTime: "09:00",
    email: ""
});
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailData, setEmailData] = useState({ to: '', subject: '', body: '' })
  const [banner, setBanner] = useState(null) // { type: 'info'|'success'|'error', text }

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

  function resetForm() {
    setForm({ name: '', type: 'Other', expiry: '', email: '' })
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.expiry) return
    if (editingId) {
      const res = await updateDoc(editingId, form)
      setDocs(docs.map(d => (String(d.id) === String(editingId) ? { ...d, ...res } : d)))
      // check expiry and possibly send immediate alert
      tryImmediateAlert(res)
    } else {
      const res = await addDoc(form)
      setDocs(prev => [{ id: res.id || res._id || res.id, ...res }, ...prev])
      // check expiry and possibly send immediate alert
      tryImmediateAlert(res)
    }
    resetForm()
  }

  async function tryImmediateAlert(doc) {
    try {
      const dl = daysLeft(doc.expiry)
      if (dl <= 5 && dl >= 0) {
        setBanner({ type: 'info', text: `${doc.name} expires in ${dl} day${dl===1?'':'s'}` })
        const to = doc.email
        if (!to) {
          setBanner({ type: 'error', text: `${doc.name} expires in ${dl} day(s) — no recipient configured` })
          return
        }
        const subject = `Doc Alert: '${doc.name}' expires in ${dl} day${dl===1?'':'s'}`
        const text = `Hello,\n\nThis is an automated reminder that your document '${doc.name}' (type: ${doc.type || 'N/A'}) expires on ${doc.expiry} (in ${dl} day${dl===1?'':'s'}).\n\n— Doc Alert`
        setBanner({ type: 'info', text: `Sending alert email to ${to}...` })
        const html = text.replace(/\n/g, '<br/>')
        const res = await fetch(`${API_BASE}/alerts/send-manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, text, html }) })
        if (res.ok) setBanner({ type: 'success', text: `Alert email sent to ${to}` })
        else setBanner({ type: 'error', text: `Failed to send alert to ${to}` })
        // clear banner after a few seconds
        setTimeout(() => setBanner(null), 8000)
      }
    } catch (e) {
      console.error('tryImmediateAlert error', e)
      setBanner({ type: 'error', text: 'Failed to send alert email (see console)' })
      setTimeout(() => setBanner(null), 8000)
    }
  }

  function startEdit(d) {
    setEditingId(d.id)
    setForm({ name: d.name, type: d.type, expiry: d.expiry, email: d.email || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function removeDoc(id) {
    if (!confirm('Delete this document?')) return
    // optimistic UI with rollback on failure
    const prev = docs
    setDocs(docs.filter(d => String(d.id) !== String(id)))
    try {
      await deleteDoc(id)
      // success — notify
      setBanner({ type: 'success', text: 'Document deleted' })
      setTimeout(() => setBanner(null), 3500)
    } catch (e) {
      console.error('delete failed', e)
      setDocs(prev)
      setBanner({ type: 'error', text: 'Failed to delete document (see console)' })
      setTimeout(() => setBanner(null), 5000)
    }
  }

  function openGmailCompose(to, subject, body) {
    const base = 'https://mail.google.com/mail/?view=cm&fs=1'
    const url = `${base}&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank')
  }

  function sendForDoc(d) {
    // removed: send button handled via Gmail compose; function kept for backward compatibility
  }

  function exportPdf() {
    const exportDocs = filtered.length ? filtered : docs
    if (!exportDocs.length) {
      alert('No documents available to export.')
      return
    }

    const pdf = new jsPDF()
    const left = 14
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const colX = [left, 88, 146]
    const colWidth = [70, 50, 44]
    const lineHeight = 7
    const bottomMargin = 20
    let y = 20

    const drawHeader = () => {
      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      pdf.text('Doc Alert Export', left, y)
      y += 10
      pdf.setFontSize(12)
      const cols = ['Name', 'Expiry status', 'Days for expiry']
      cols.forEach((col, idx) => pdf.text(col, colX[idx], y))
      y += 6
      pdf.setLineWidth(0.5)
      pdf.line(left, y, pageWidth - left, y)
      y += 8
      pdf.setFont(undefined, 'normal')
    }

    drawHeader()

    exportDocs.forEach((d, index) => {
      const dl = daysLeft(d.expiry)
      const status = dl < 0 ? 'Expired' : dl === 0 ? 'Expires today' : 'Active'
      const daysText = dl < 0 ? `${Math.abs(dl)} day${Math.abs(dl) === 1 ? '' : 's'} ago` : `${dl} day${dl === 1 ? '' : 's'}`

      const nameLines = pdf.splitTextToSize(String(d.name), colWidth[0])
      const statusLines = pdf.splitTextToSize(status, colWidth[1])
      const daysLines = pdf.splitTextToSize(daysText, colWidth[2])
      const rowHeight = Math.max(nameLines.length, statusLines.length, daysLines.length) * lineHeight

      if (y + rowHeight + bottomMargin > pageHeight) {
        pdf.addPage()
        y = 20
        drawHeader()
      }

      const maxLines = Math.max(nameLines.length, statusLines.length, daysLines.length)
      for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
        const lineY = y + lineHeight * lineIndex
        const nameLine = nameLines[lineIndex] || ''
        const statusLine = statusLines[lineIndex] || ''
        const daysLine = daysLines[lineIndex] || ''
        pdf.text(nameLine, colX[0], lineY)
        pdf.text(statusLine, colX[1], lineY)
        pdf.text(daysLine, colX[2], lineY)
      }

      y += rowHeight
      if (index < exportDocs.length - 1) {
        pdf.setDrawColor(200)
        pdf.setLineWidth(0.2)
        pdf.line(left, y - 3, pageWidth - left, y - 3)
        pdf.setDrawColor(0)
      }
      y += 4
    })

    pdf.save('doc-alert-export.pdf')
  }

  const filtered = docs.filter(d => d.name.toLowerCase().includes(query.toLowerCase()) || d.type.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Doc Alert — Dashboard</h1>
        <div className="text-sm text-gray-500">Notifications: 5 days before expiry</div>
      </header>

      {banner && (
        <div className={`mb-4 p-3 rounded ${banner.type === 'success' ? 'bg-green-100 text-green-800' : banner.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
          {banner.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <form className="md:col-span-1" onSubmit={handleSubmit}>
          <h2 className="font-semibold mb-3">Add / Edit Document</h2>
          <div className="space-y-3">
            <input className="w-full border rounded px-3 py-2" placeholder="Document name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="w-full border rounded px-3 py-2" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option>Other</option>
              <option>ID</option>
              <option>Insurance</option>
              <option>Contract</option>
            </select>
            <input className="w-full border rounded px-3 py-2" type="date" value={form.expiry} onChange={e => setForm({ ...form, expiry: e.target.value })} />
            <input className="w-full border rounded px-3 py-2" placeholder="Optional email for notifications" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <div className="flex gap-2">
              <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">{editingId ? 'Save' : 'Add'}</button>
              <button type="button" className="px-4 py-2 border rounded" onClick={resetForm}>Clear</button>
            </div>
          </div>
        </form>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <input className="border rounded px-3 py-2 w-1/2" placeholder="Search name or type" value={query} onChange={e => setQuery(e.target.value)} />
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={() => {
                const expiring = docs.filter(d => daysLeft(d.expiry) <= 5 && daysLeft(d.expiry) >= 0)
                if (!expiring.length) return alert('No docs expiring within 5 days')
                const body = expiring.map(d => `${d.name} — expires ${d.expiry} (${daysLeft(d.expiry)} days)`).join('\n')
                setEmailData({ to: '', subject: 'Documents expiring soon', body: `Expiring documents:\n\n${body}` })
                setEmailOpen(true)
              }}>Compose Alert</button>
              <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={exportPdf}>Export PDF</button>
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
                          <button className="px-2 py-1 border rounded" onClick={() => startEdit(d)}>Edit</button>
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
      </div>
    </div>
    <EmailModal open={emailOpen} onClose={() => setEmailOpen(false)} initialTo={emailData.to} initialSubject={emailData.subject} initialBody={emailData.body} />
    </>
  )
}

export default Dashboard
