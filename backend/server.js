const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const nodemailer = require('nodemailer')

dotenv.config()

const app = express()
app.use(cors())
app.use(bodyParser.json())

const MONGO_URL = process.env.MONGO_URL || 'mongodb+srv://kailasgrtvm_db_user:kailas@cluster0.vlppxf7.mongodb.net/docalert?retryWrites=true&w=majority'

mongoose.connect(MONGO_URL)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error', err))

const docSchema = new mongoose.Schema({
	name: { type: String, required: true },
	type: { type: String },
	expiry: { type: Date, required: true },
	email: { type: String },
	lastAlertSent: { type: Date }
}, { timestamps: true })

const Doc = mongoose.model('Doc', docSchema)

// Email transporter (optional) - configure via environment variables
let transporter = null
const SMTP_HOST = process.env.SMTP_HOST
if (SMTP_HOST) {
	transporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port: Number(process.env.SMTP_PORT) || 587,
		secure: process.env.SMTP_SECURE === 'true',
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASS,
		}
	})
    // verify transporter config at startup
    transporter.verify().then(() => console.log('SMTP transporter verified')).catch(err => console.error('SMTP verify failed', err))
} else {
	console.warn('SMTP not configured. Alert emails will be skipped. Set SMTP_HOST in .env to enable.')
}

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@docalert'
const ALERT_TO_FALLBACK = process.env.ALERT_TO || null

function daysLeft(date) {
	const now = new Date()
	const diff = Math.ceil((new Date(date) - now) / (1000 * 60 * 60 * 24))
	return diff
}

async function sendAlertEmail(to, subject, text, html) {
	if (!transporter) {
		console.warn('sendAlertEmail: transporter not configured')
		return false
	}
	try {
		console.log(`sendAlertEmail: sending to ${to} subject="${subject}" html=${!!html}`)
		const mail = { from: EMAIL_FROM, to, subject }
		if (text) mail.text = text
		if (html) mail.html = html
		await transporter.sendMail(mail)
		return true
	} catch (e) {
		console.error('sendAlertEmail error', e)
		return false
	}
}

async function checkAndSendAlerts() {
	try {
		const now = new Date()
		const max = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
		const docs = await Doc.find({ expiry: { $lte: max } }).lean()
		console.log(`checkAndSendAlerts: found ${docs.length} docs with expiry <= ${max.toISOString().slice(0,10)}`)
		for (const d of docs) {
			console.log(`doc ${d._id}: name=${d.name} expiry=${d.expiry} email=${d.email} lastAlertSent=${d.lastAlertSent}`)
			const dl = daysLeft(d.expiry)
			// only notify for documents expiring within next 5 days (>=0)
			if (dl <= 5 && dl >= 0) {
				const last = d.lastAlertSent ? new Date(d.lastAlertSent) : null
				const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
				const alreadySentToday = last && last >= today
				if (alreadySentToday) {
					console.log(`doc ${d._id}: already alerted today (lastAlertSent=${last})`)
					continue
				}

				const to = d.email || ALERT_TO_FALLBACK
				if (!to) {
					console.log(`doc ${d._id}: No recipient (email empty) and no ALERT_TO fallback, skipping.`)
					continue
				}

				const subject = `Doc Alert: '${d.name}' expires in ${dl} day${dl===1?'':'s'}`
				const text = `Hello,\n\nThis is an automated reminder that your document '${d.name}' (type: ${d.type || 'N/A'}) expires on ${new Date(d.expiry).toISOString().slice(0,10)} (in ${dl} day${dl===1?'':'s'}).\n\n— Doc Alert`
				const html = `<p>Hello,</p><p>This is an automated reminder that your document <strong>${d.name}</strong> (type: ${d.type || 'N/A'}) expires on <strong>${new Date(d.expiry).toISOString().slice(0,10)}</strong> (in ${dl} day${dl===1?'':'s'}).</p><p>— Doc Alert</p>`
				const ok = await sendAlertEmail(to, subject, text, html)
				if (ok) {
					await Doc.findByIdAndUpdate(d._id, { lastAlertSent: new Date() })
					console.log(`Sent alert for doc ${d._id} to ${to}`)
				}
			}
		}
	} catch (e) {
		console.error('checkAndSendAlerts error', e)
	}
}

// run every hour
setInterval(() => { checkAndSendAlerts() }, 1000 * 60 * 60)

// run once on startup so tests (short-expiry docs) trigger immediately
checkAndSendAlerts().then(() => console.log('Initial alert check complete')).catch(e => console.error('Initial alert check error', e))

// manual trigger
app.post('/api/alerts/send-now', async (req, res) => {
	try {
		await checkAndSendAlerts()
		res.json({ ok: true })
	} catch (e) {
		res.status(500).json({ error: 'failed' })
	}
})

// manual send: accepts { to, subject, text }
app.post('/api/alerts/send-manual', async (req, res) => {
	try {
		const { to, subject, text, html } = req.body || {}
		if (!to || !subject || (!text && !html)) return res.status(400).json({ error: 'missing to/subject/text-or-html' })
		if (!transporter) return res.status(500).json({ error: 'SMTP not configured' })
		const ok = await sendAlertEmail(to, subject, text, html)
		if (ok) return res.json({ ok: true })
		return res.status(500).json({ error: 'send failed' })
	} catch (e) {
		console.error('manual send error', e)
		res.status(500).json({ error: 'failed' })
	}
})

app.get('/api/docs', async (req, res) => {
	try {
		const docs = await Doc.find().sort({ createdAt: -1 }).lean()
		res.json(docs.map(d => ({ ...d, expiry: d.expiry ? d.expiry.toISOString().slice(0,10) : null })))
	} catch (e) {
		res.status(500).json({ error: 'Failed to fetch docs' })
	}
})

app.post('/api/docs', async (req, res) => {
	try {
		const { name, type, expiry, email } = req.body
		const doc = new Doc({ name, type, expiry: new Date(expiry), email })
		await doc.save()
		res.status(201).json({ id: doc._id, name: doc.name, type: doc.type, expiry: doc.expiry.toISOString().slice(0,10), email: doc.email })
	} catch (e) {
		res.status(500).json({ error: 'Failed to create doc' })
	}
})

app.put('/api/docs/:id', async (req, res) => {
	try {
		const { id } = req.params
		const { name, type, expiry, email } = req.body
		const doc = await Doc.findByIdAndUpdate(id, { name, type, expiry: new Date(expiry), email }, { new: true })
		if (!doc) return res.status(404).json({ error: 'Not found' })
		res.json({ id: doc._id, name: doc.name, type: doc.type, expiry: doc.expiry.toISOString().slice(0,10), email: doc.email })
	} catch (e) {
		res.status(500).json({ error: 'Failed to update doc' })
	}
})

app.delete('/api/docs/:id', async (req, res) => {
	try {
		const { id } = req.params
		await Doc.findByIdAndDelete(id)
		res.json({ success: true })
	} catch (e) {
		res.status(500).json({ error: 'Failed to delete doc' })
	}
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
