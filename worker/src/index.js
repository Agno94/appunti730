import JSZip from 'jszip'
import { v4 as uuid } from 'uuid'
import _ from 'lodash'



function isAuthOk(request, env) {
	const authorizationHeader = request.headers.get('Authorization')
	const token = env.TOKEN
	console.log(`${authorizationHeader} == ${token}: ${(authorizationHeader === token)}`)
	return (authorizationHeader === token)
}

function httpError(message, status) {
	const body = {
		error: true,
		message,
		status,
	}
	return Response.json(body, {status, })
}

async function getPeople(request, env, url) {
	const peopleRaw = await env.KV_NAMESPACE.get('people')
	if (!peopleRaw) throw {message: "Not ready"}

	const people = JSON.parse(peopleRaw)

	const responseBody = {
		message: `Found ${people.length} people`,
		data: people,
	}

	return Response.json(responseBody);
}

async function setPeople(request, env, url) {
	let people
	let givenAdminToken
	try {
		const payload = await request.json()
		people = payload.people
		givenAdminToken = payload.adminToken
	} catch (e) {
		return httpError(`Bad request: invalid payload`, 400)
	}

	const adminToken = env.ADMIN_TOKEN
	if (adminToken != givenAdminToken) {
		return httpError('Not authorized', 403)
	}

	const nofPeople = people.length
	if (people.length < 1) {
		return httpError(`Bad request: too short`, 400)
	}

	let nameSet = new Set(people.map(p => p.name))
	let idSet = new Set(people.map(p => p.id))
	if ((nameSet.size != nofPeople) || (idSet.size != nofPeople)) {
		return httpError(`Bad request: collision`, 400)
	}

	await env.KV_NAMESPACE.put('people', JSON.stringify(people))

	return Response.json({
		message: `Saved ${people.length} people`
	})
}

async function postSaveEntry(request, env, url) {
	let payload
	try {
		payload = await request.json()
	} catch (e) {
		return httpError("Bad Request: invalid payload", 400)
	}
	const {user, date, importo, year, content} = payload

	if (!user || !date || !importo || !content || !year) {
		return httpError("Bad Request: Missing fields", 400)
	}

	let originalMBs = content.length * 0.75 / 2**20
	if (originalMBs > 6) {
		return httpError(`File troppo grande: ${originalMBs}>6MiB`, 400)
	}

	const peopleRaw = await env.KV_NAMESPACE.get('people')
	if (!peopleRaw) throw {message: "Not ready"}

	const selectedPeople = JSON.parse(peopleRaw).filter(u => (u.name == user))
	if (selectedPeople.length != 1) {
		return httpError(`Bad Request: Invalid user ${user}`, 400)
	}

	const person = selectedPeople[0]
	const uid = person.id
	const eid = uuid()

	const entryContentKey = `U${uid}::E${eid}::content`
	const userEntriesKey = `U${uid}::entries${year}`

	const userEntriesRaw = await env.KV_NAMESPACE.get(userEntriesKey)
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

	await env.KV_NAMESPACE.put(userEntriesKey, JSON.stringify(userEntries))

	await env.KV_NAMESPACE.put(entryContentKey, content)

	return Response.json({
		message: `Entry saved with id ${eid}`,
		data: entry,
	})
}

async function deleteEntry(request, env, url) {
	let eid, user, year
	try {
		const payload = await request.json()
		eid = payload.id
		user = payload.user
		year = payload.year
	} catch (e) {
		return httpError("Bad Request: invalid payload", 400)
	}

	if (!eid || !user || !year) {
		return httpError("Bad Request: Missing fields", 400)
	}

	const peopleRaw = await env.KV_NAMESPACE.get('people')
	if (!peopleRaw) throw {message: "Not ready"}

	const selectedPeople = JSON.parse(peopleRaw).filter(u => (u.name == user))
	if (selectedPeople.length != 1) {
		return httpError(`Bad Request: Invalid user ${user}`, 400)
	}

	const person = selectedPeople[0]
	const uid = person.id

	const entryContentKey = `U${uid}::E${eid}::content`
	const userEntriesKey = `U${uid}::entries${year}`

	const userEntriesRaw = await env.KV_NAMESPACE.get(userEntriesKey)
	let userEntries = []
	if (userEntriesRaw) {
		userEntries = JSON.parse(userEntriesRaw)
	}
	let filteredEntries = userEntries.filter(e => (e.id === eid))
	if (filteredEntries.length !== 1) {
		return httpError("Bad Request: id not found", 400)
	}
	userEntries = userEntries.filter(e => (e.id != eid))

	await env.KV_NAMESPACE.delete(entryContentKey)
	await env.KV_NAMESPACE.put(userEntriesKey, JSON.stringify(userEntries))

	return Response.json({
		message: `Entry with id ${eid} deleted`,
		data: filteredEntries[0],
	})
}

async function getEntries(request, env, url) {
	const year = url.searchParams.get("year")
	const name = url.searchParams.get("person")
	if (!name || !year) {
		return httpError("Bad Request: Missing fields", 400)
	}

	const peopleRaw = await env.KV_NAMESPACE.get('people')
	if (!peopleRaw) throw {message: "Not ready"}

	const selectedPeople = JSON.parse(peopleRaw).filter(u => (u.name == name))
	if (selectedPeople.length != 1) {
		return httpError(`Bad Request: Invalid user ${user}`, 400)
	}

	const person = selectedPeople[0]
	const userEntriesKey = `U${person.id}::entries${year}`

	const userEntriesRaw = await env.KV_NAMESPACE.get(userEntriesKey)
	let userEntries = []
	if (userEntriesRaw) {
		userEntries = JSON.parse(userEntriesRaw)
	}

	return Response.json({
		message: `Found ${userEntries.length} entries for ${name} year ${year}`,
		data: userEntries,
	})
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS,DELETE",
	"Access-Control-Max-Age": "86400",
}

async function handleOptions(request) {
	if (
		request.headers.get("Origin") !== null &&
		request.headers.get("Access-Control-Request-Method") !== null &&
		request.headers.get("Access-Control-Request-Headers") !== null
	) {
		// Handle CORS preflight requests.
		return new Response(null, {
			headers: {
				...corsHeaders,
				"Access-Control-Allow-Headers": request.headers.get(
					"Access-Control-Request-Headers",
				),
			},
		});
	} else {
		// Handle standard OPTIONS request.
		return new Response(null, {
			headers: {
				Allow: "GET, HEAD, POST, OPTIONS, DELETE",
			},
		});
	}
}


export default {

	async fetch(request, env, ctx) {
		if (request.method === 'OPTIONS') {
			return handleOptions(request)
		}
		let response = await this.handleRequest(request, env, ctx)
		response.headers.set("Access-Control-Allow-Origin", '*')
		return response
	},

	async handleRequest(request, env, ctx) {
		const url = new URL(request.url)

		if (request.method === 'GET' && url.pathname === '/') {
			return Response.json({ok: true})
		}

		console.log(`Requested ${navigator.userAgent} at path ${url.pathname}!`);

		if (!isAuthOk(request, env)) {
			return httpError(`Not authorized`, 403)
		}

		try {
			if (request.method === "POST" && url.pathname === "/entry") {
				return await postSaveEntry(request, env, url)
			}

			if (request.method === "DELETE" && url.pathname === "/entry") {
				return await deleteEntry(request, env, url)
			}

			if (request.method === "GET" && url.pathname === "/entries") {
				return await getEntries(request, env, url)
			}

			if (request.method === "GET" && url.pathname === "/people") {
				return await getPeople(request, env, url)
			}

			if (request.method === "POST" && url.pathname === "/people") {
				return await setPeople(request, env, url)
			}
		} catch (error) {
			console.log('Error:', error)
			return httpError(`Internal error: ${error.message.slice(0,20)}`, 500)
		}

    return httpError("Not found", 404)
	},

}
