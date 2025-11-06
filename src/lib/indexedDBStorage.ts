// Lightweight IndexedDB helper for storing large file blobs
// Provides simple put/get/delete operations keyed by fileId

const DB_NAME = 'next-file-guard'
const FILE_STORE = 'files'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, mode)
    const store = tx.objectStore(FILE_STORE)
    fn(store)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function putBlob(fileId: string, blob: Blob): Promise<void> {
  await withStore('readwrite', (store) => {
    store.put(blob, fileId)
  })
}

export async function getBlob(fileId: string): Promise<Blob | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readonly')
    const store = tx.objectStore(FILE_STORE)
    const req = store.get(fileId)
    req.onsuccess = () => {
      resolve((req.result as Blob) ?? null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function deleteBlob(fileId: string): Promise<void> {
  await withStore('readwrite', (store) => {
    store.delete(fileId)
  })
}

export default { putBlob, getBlob, deleteBlob }