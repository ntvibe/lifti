const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'

async function driveFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Google Drive request failed (${response.status}): ${details}`)
  }

  return response
}

export async function findFileIdByName(accessToken, filename) {
  const query = encodeURIComponent(`name='${filename.replace(/'/g, "\\'")}' and trashed=false`)
  const fields = encodeURIComponent('files(id,name),nextPageToken')
  const url = `${DRIVE_API}?spaces=appDataFolder&q=${query}&fields=${fields}&pageSize=1`
  const response = await driveFetch(url, accessToken)
  const data = await response.json()
  return data.files?.[0]?.id ?? null
}

export async function readJson(accessToken, fileId) {
  const response = await driveFetch(`${DRIVE_API}/${fileId}?alt=media`, accessToken)
  return response.json()
}

export async function createJson(accessToken, filename, obj) {
  const metadata = {
    name: filename,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  }

  const boundary = `lifti-${Date.now()}`
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(obj),
    `--${boundary}--`,
  ].join('\r\n')

  const response = await driveFetch(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id`, accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  })

  return response.json()
}

export async function updateJson(accessToken, fileId, obj) {
  const response = await driveFetch(`${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`, accessToken, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(obj),
  })

  return response.json()
}

export async function upsertJsonByName(accessToken, filename, defaultObj) {
  const fileId = await findFileIdByName(accessToken, filename)

  if (fileId) {
    const data = await readJson(accessToken, fileId)
    return { fileId, data }
  }

  const created = await createJson(accessToken, filename, defaultObj)
  return { fileId: created.id, data: defaultObj }
}
