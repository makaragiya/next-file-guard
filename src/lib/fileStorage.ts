// IndexedDB wrapper for file storage

export interface StoredFile {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  data: ArrayBuffer;
  uploadDate: Date;
  uploadedBy: string;
}

const DB_NAME = 'FileManager2025';
const STORE_NAME = 'files';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

// Initialize IndexedDB
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('path', 'path', { unique: false });
        objectStore.createIndex('name', 'name', { unique: false });
      }
    };
  });
};

// Get all files
export const getAllFiles = async (): Promise<StoredFile[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Add file
export const addFile = async (file: File, path: string, uploadedBy: string): Promise<StoredFile> => {
  const database = await initDB();
  const arrayBuffer = await file.arrayBuffer();
  
  const storedFile: StoredFile = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: file.name,
    path: path,
    type: file.type,
    size: file.size,
    data: arrayBuffer,
    uploadDate: new Date(),
    uploadedBy
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(storedFile);

    request.onsuccess = () => resolve(storedFile);
    request.onerror = () => reject(request.error);
  });
};

// Delete file
export const deleteFile = async (id: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Get files by path
export const getFilesByPath = async (path: string): Promise<StoredFile[]> => {
  const allFiles = await getAllFiles();
  return allFiles.filter(f => f.path === path);
};

// Search files
export const searchFiles = async (query: string): Promise<StoredFile[]> => {
  const allFiles = await getAllFiles();
  const lowerQuery = query.toLowerCase();
  return allFiles.filter(f => f.name.toLowerCase().includes(lowerQuery));
};

// Get unique folders
export const getFolders = async (): Promise<string[]> => {
  const allFiles = await getAllFiles();
  const folders = new Set<string>();
  
  allFiles.forEach(file => {
    const parts = file.path.split('/').filter(Boolean);
    let currentPath = '';
    parts.forEach(part => {
      currentPath += '/' + part;
      folders.add(currentPath);
    });
  });
  
  return Array.from(folders).sort();
};

// Download file
export const downloadFile = (file: StoredFile) => {
  const blob = new Blob([file.data], { type: file.type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
