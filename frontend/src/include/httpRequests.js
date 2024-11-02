const BASE_API_URL = import.meta.env.VITE_API_URL

export async function requestToWorker({method, path, auth, payload}) {
  const url = `${BASE_API_URL}${path}`
  const options = {
    method,
    headers: {
      "Authorization": auth,
    }
  }
  if (payload) {
    options.body = JSON.stringify(payload)
  }
  return await fetch(url, options)
}
