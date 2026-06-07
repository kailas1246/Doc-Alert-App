import React, { useEffect, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'

const Icon = ({ path, title }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
    {title && <title>{title}</title>}
  </svg>
)

const EmailModal = ({ open, onClose, initialTo = '', initialSubject = '', initialBody = '' }) => {
  const [to, setTo] = useState(initialTo)
  const [subject, setSubject] = useState(initialSubject)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [preview, setPreview] = useState(false)
  const [files, setFiles] = useState([])
  const editorRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTo(initialTo || '')
      setSubject(initialSubject || '')
      if (editorRef.current) editorRef.current.innerHTML = initialBody || ''
      setFeedback(null)
      setPreview(false)
      setFiles([])
    }
  }, [open, initialTo, initialSubject, initialBody])

  if (!open) return null

  function execCmd(cmd, val = null) {
    try {
      document.execCommand(cmd, false, val)
      editorRef.current.focus()
    } catch (e) {
      console.warn('execCmd unsupported', e)
    }
  }

  function getBody() {
    return editorRef.current ? editorRef.current.innerHTML : ''
  }

  function handleFiles(e) {
    const list = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...list])
  }

  async function send() {
    const html = getBody()
    const plain = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!to || !subject || !plain) {
      setFeedback({ type: 'error', text: 'Please fill To, Subject and Body.' })
      return
    }
    setSending(true)
    setFeedback(null)
    try {
      const res = await fetch(`${API_BASE}/alerts/send-manual`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, text: plain, html })
      })
      if (!res.ok) throw new Error('send failed')
      setFeedback({ type: 'success', text: 'Email sent successfully.' })
      setTimeout(() => { onClose() }, 900)
    } catch (e) {
      console.error(e)
      setFeedback({ type: 'error', text: 'Failed to send email. See console.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-start justify-center z-50 p-6 email-modal-backdrop">
      <div className="email-modal-card">
        <header className="email-modal-header">
          <div>
            <div className="text-sm text-gray-500">From</div>
            <div className="font-medium">Doc Alert <span className="text-xs text-gray-400">&lt;no-reply@docalert&gt;</span></div>
          </div>
          <div className="email-modal-header-actions">
            <button className="btn-ghost" onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
            <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </header>

        <div className="email-modal-body">
          <div className="field-row">
            <label className="field-label">To</label>
            <input className="field-input" value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" />
          </div>

          <div className="field-row">
            <label className="field-label">Subject</label>
            <input className="field-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Alert: document expiring soon" />
          </div>

          <div className="editor-toolbar">
            <button title="Bold" onClick={() => execCmd('bold')} className="tool-btn"><Icon path="M6 4h6a2 2 0 010 4H6z M6 12h7a2 2 0 010 4H6z" /></button>
            <button title="Italic" onClick={() => execCmd('italic')} className="tool-btn"><Icon path="M10 4l4 0 M8 20l4 0" /></button>
            <button title="Underline" onClick={() => execCmd('underline')} className="tool-btn"><Icon path="M6 4v6a4 4 0 008 0V4" /></button>
            <button title="Link" onClick={() => {
              const url = prompt('Insert URL')
              if (url) execCmd('createLink', url)
            }} className="tool-btn"><Icon path="M10 14a3 3 0 004.24 0l2.12-2.12M14 10a3 3 0 00-4.24 0L7.64 12.12" /></button>
            <div className="toolbar-spacer" />
            <label className="attach-btn">
              <input type="file" multiple onChange={handleFiles} />
              <Icon path="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <span className="ml-2">Attach</span>
            </label>
          </div>

          <div className="editor-container">
            {!preview ? (
              <div ref={editorRef} contentEditable className="email-editor" dangerouslySetInnerHTML={{ __html: initialBody }}></div>
            ) : (
              <div className="email-preview">
                <div className="email-card">
                  <div className="email-card-header">
                    <div className="email-subject">{subject || '(no subject)'}</div>
                    <div className="email-meta">To: {to}</div>
                  </div>
                  <div className="email-card-body" dangerouslySetInnerHTML={{ __html: getBody() }} />
                </div>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="attachments">
              {files.map((f, i) => <div key={i} className="attachment">{f.name}</div>)}
            </div>
          )}

          {feedback && (
            <div className={`feedback ${feedback.type === 'success' ? 'success' : 'error'}`}>{feedback.text}</div>
          )}
        </div>

        <footer className="email-modal-footer">
          <div className="footer-left text-sm text-gray-500">Professional email preview — matches sent HTML</div>
          <div className="footer-actions">
            <button className="btn-cancel" onClick={onClose} disabled={sending}>Cancel</button>
            <button className="btn-primary" onClick={send} disabled={sending}>{sending ? 'Sending...' : 'Send Email'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default EmailModal
