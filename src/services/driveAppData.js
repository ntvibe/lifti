const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'

export const AUTH_EXPIRED_ERROR_CODE = 'AUTH_EXPIRED'

export function isAuthExpiredError(error) {
  return error?.code === AUTH_EXPIRED_ERROR_CODE || error?.status === 401
}

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
    const error = new Error(`Google Drive request failed (${response.status}): ${details}`)
    error.status = response.status
    if (response.status === 401) {
      error.code = AUTH_EXPIRED_ERROR_CODE
    }
    throw error
  }

  return response
}

export async function ensureDriveClientReady(accessToken) {
  const fields = encodeURIComponent('files(id)')
  await driveFetch(`${DRIVE_API}?spaces=appDataFolder&fields=${fields}&pageSize=1`, accessToken)
}

export async function listDriveFiles(accessToken, query, pageSize = 100) {
  const fields = encodeURIComponent('files(id,name,modifiedTime,size,mimeType),nextPageToken')
  const q = encodeURIComponent(`${query} and trashed=false`)
  const allFiles = []
  let pageToken = ''

  do {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
    const url = `${DRIVE_API}?spaces=appDataFolder&fields=${fields}&q=${q}&pageSize=${pageSize}${tokenParam}`
    const response = await driveFetch(url, accessToken)
    const data = await response.json()
    allFiles.push(...(data.files || []))
    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return allFiles
}

export async function listPlanFiles(accessToken) {
  return listDriveFiles(accessToken, "name contains 'lifti_plan_' and mimeType='application/json'")
}

export async function listLiftiFiles(accessToken) {
  return listDriveFiles(accessToken, "name contains 'lifti_'")
}

export async function readFileJson(accessToken, fileId) {
  const response = await driveFetch(`${DRIVE_API}/${fileId}?alt=media`, accessToken)
  return response.json()
}

export async function readPlanFiles(accessToken) {
  const files = await listPlanFiles(accessToken)
  const warnings = []

  const plans = await Promise.all(
    files.map(async (file) => {
      try {
        const json = await readFileJson(accessToken, file.id)
        return { ...json, _fileId: file.id, _fileName: file.name, _modifiedTime: file.modifiedTime }
      } catch (error) {
        warnings.push(`Could not parse ${file.name}`)
        return null
      }
    }),
  )

  return { plans: plans.filter(Boolean), files, warnings }
}

export async function deleteDriveFile(accessToken, fileId) {
  await driveFetch(`${DRIVE_API}/${fileId}`, accessToken, { method: 'DELETE' })
}

export async function deleteAllLiftiFiles(accessToken, onProgress) {
  const files = await listLiftiFiles(accessToken)
  let completed = 0

  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    await deleteDriveFile(accessToken, file.id)
    completed += 1
    onProgress?.(completed, files.length)
  }

  return files.length
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
  return readFileJson(accessToken, fileId)
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

  const response = await driveFetch(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime,size,mimeType`, accessToken, {
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
