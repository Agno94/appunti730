import JSZip from 'jszip'
import { v4 as uuid } from 'uuid'
import _ from 'lodash'

import { Hono } from 'hono'
import { cors } from 'hono/cors'

function httpError(c, message, status) {
	const body = {
		error: true,
		ok: false,
		message,
		status,
	}
	return c.json(body, status)
}

class AppHTTPError extends Error {
  constructor(message, httpStatusCode) {
    super(message)
    this.name = 'AppHTTPError'
    this.httpStatusCode = httpStatusCode
		this.isHTTPError = true
  }
}

// Setup Hono + CORS
const app = new Hono()
app.get('/', (c) => c.json({ok: true}, 200))
app.use('*', cors())

// Rate limit + Autorizzazione
app.use('*', async (c, next) => {
	// Rate Limit
	let rateLimit, rateKey
	rateKey = `AUTH:${c.req.raw.cf.asn}:${c.req.header('CF-Connecting-IP')}`
	const hasFailedLastAuth = (await c.env.KV_NAMESPACE.get(rateKey)) == 'FAIL'
	if (hasFailedLastAuth) {
		rateLimit = await c.env.RATE_LIMITER_FAILEDAUTH.limit({key: ''})
	} else {
		rateLimit = await c.env.RATE_LIMITER_AUTHNOTFAILED.limit({key: rateKey})
	}
	if (!rateLimit.success) return httpError(c, 'Too Many Request: wait 60s', 429)

	// Auth
	const authorizationHeader = c.req.header('Authorization')
	const token = c.env.TOKEN
	if (authorizationHeader !== `Bearer ${token}`) {
		console.log(`Denied: provided token=${authorizationHeader} rateKey=${rateKey}`)
		await c.env.KV_NAMESPACE.put(rateKey, 'FAIL')
		return httpError(c, `Not authorized`, 403)
	}
	if (hasFailedLastAuth) await c.env.KV_NAMESPACE.delete(rateKey)
	await next()
})

// Log e tempi richiesta
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
	const end = Date.now()
  const ms = end - start
  c.header('X-Response-Duration', `${ms}ms`)
  c.header('X-Response-Timestamp', `${end}`)
	console.log(`Request completed in ${ms}ms`)
})

// Gestione not-found ed errori
app.notFound((c) => httpError(c, 'Not Found', 404))
app.onError((err, c) => {
	if (err.httpStatusCode && err.isHTTPError) {
		return httpError(c, err.message, err.httpStatusCode)
	}
	console.error(err)
	return httpError(c, `Internal error: ${err.message.slice(0,30)}`, 500)
})

// ROUTE UTENTI
async function fetchPersonByName(c, filter) {
	const peopleRaw = await c.env.KV_NAMESPACE.get('people')
	if (!peopleRaw) throw new Error("Not ready")

	const people = JSON.parse(peopleRaw)
	if (!filter) return people

	const selectedPeople = people.filter(filter)
	if (selectedPeople.length == 0) {
		throw new AppHTTPError('Bad Request: found no user', 400)
	}
	if (selectedPeople.length > 1) {
		throw new Error(`User collision: ${selectedPeople.length}`)
	}
	return selectedPeople
}

app.get('/people', async (c) => {
	const people = await fetchPersonByName(c)

	const responseBody = {
		message: `Found ${people.length} people`,
		data: people,
	}

	return c.json(responseBody);
})

app.post('/people', async (c) => {
	let people
	let givenAdminToken
	try {
		const payload = await c.req.json()
		people = payload.people
		givenAdminToken = payload.adminToken
	} catch (e) {
		throw new AppHTTPError(`Bad request: invalid payload`, 400)
	}

	const adminToken = c.env.ADMIN_TOKEN
	if (adminToken != givenAdminToken) {
		throw new AppHTTPError('Not authorized', 403)
	}

	const nofPeople = people.length
	if (nofPeople < 1) {
		throw new AppHTTPError(`Bad request: too short`, 400)
	}

	let nameSet = new Set(people.map(p => p.name))
	let idSet = new Set(people.map(p => p.id))
	if ((nameSet.size != nofPeople) || (idSet.size != nofPeople)) {
		throw new AppHTTPError(`Bad request: collision`, 400)
	}

	await c.env.KV_NAMESPACE.put('people', JSON.stringify(people))

	return c.json({
		message: `Saved ${people.length} people`
	}, 201)
})

// ROUTE VOCI
app.post('/entry', async (c) => {
	let payload
	try {
		payload = await c.req.json()
	} catch (e) {
		throw new AppHTTPError('Bad Request: invalid payload', 400)
	}

	const {user, date, importo, year, content} = payload
	if (!user || !date || !importo || !content || !year) {
		throw new AppHTTPError('Bad Request: invalid payload', 400)
	}

	let originalMBs = content.length * 0.75 / 2**20
	if (originalMBs > 6) {
		throw new AppHTTPError(`File troppo grande: ${originalMBs}>6MiB`, 400)
	}

	const selectedPeople = await fetchPersonByName(c, u => (u.name == user))
	const person = selectedPeople[0]
	const uid = person.id
	const eid = uuid()
	const entryContentKey = `U${uid}::E${eid}::content`
	const userEntriesKey = `U${uid}::entries${year}`

	const userEntriesRaw = await c.env.KV_NAMESPACE.get(userEntriesKey)
	let userEntries = []
	if (userEntriesRaw) {
		userEntries = JSON.parse(userEntriesRaw)
	}
	const entry = {
		uid: uid,
		id: eid,
		importo,
		date,
	}
	userEntries.push(entry)

	await c.env.KV_NAMESPACE.put(userEntriesKey, JSON.stringify(userEntries))
	await c.env.KV_NAMESPACE.put(entryContentKey, content)

	return c.json({
		message: `Entry saved with id ${eid}`,
		data: entry,
	})
})

app.delete('/entry', async (c) => {
	let eid, user, year
	try {
		const payload = await c.req.json()
		eid = payload.id
		user = payload.user
		year = payload.year
	} catch (e) {
		throw new AppHTTPError('Bad Request: invalid payload', 400)
	}

	if (!eid || !user || !year) {
		throw new AppHTTPError('Bad Request: Missing fields', 400)
	}

	const selectedPeople = await fetchPersonByName(c, u => (u.name == user))
	const person = selectedPeople[0]
	const uid = person.id
	const entryContentKey = `U${uid}::E${eid}::content`
	const userEntriesKey = `U${uid}::entries${year}`

	const userEntriesRaw = await c.env.KV_NAMESPACE.get(userEntriesKey)
	let userEntries = []
	if (userEntriesRaw) {
		userEntries = JSON.parse(userEntriesRaw)
	}
	let filteredEntries = userEntries.filter(e => (e.id === eid))
	if (filteredEntries.length !== 1) {
		throw new AppHTTPError('Bad Request: id not found', 400)
	}
	userEntries = userEntries.filter(e => (e.id != eid))

	await c.env.KV_NAMESPACE.delete(entryContentKey)
	await c.env.KV_NAMESPACE.put(userEntriesKey, JSON.stringify(userEntries))

	return c.json({
		message: `Entry with id ${eid} deleted`,
		data: filteredEntries[0],
	})
})

app.get('/entries/:person/:year', async (c) => {
	const year = c.req.param('year')
	const name = c.req.param('person')

	const selectedPeople = await fetchPersonByName(c, u => (u.name == name))
	const person = selectedPeople[0]
	const userEntriesKey = `U${person.id}::entries${year}`

	const userEntriesRaw = await c.env.KV_NAMESPACE.get(userEntriesKey)
	let userEntries = []
	if (userEntriesRaw) {
		userEntries = JSON.parse(userEntriesRaw)
	}

	return c.json({
		message: `Found ${userEntries.length} entries for ${name} year ${year}`,
		data: userEntries,
	})
})

// --

export default app
