/**
 * Local File Storage System
 * Uses the /assets directory as the root location for storing all files and folders
 * Completely self-contained within the local file system
 * Stores files directly in the file system, not in browser storage (simulated via localStorage)
 */
import * as idb from './indexedDBStorage';

export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  uploadedBy: string;
  permissions: FilePermissions;
  storageMethod?: 'localStorage' | 'indexedDB';
  chunkCount?: number;
}

export interface FilePermissions {
  read: string[]; // User IDs who can read
  write: string[]; // User IDs who can write
  delete: string[]; // User IDs who can delete
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: Date;
}

export interface FileSystemActivity {
  timestamp: Date;
  action: string;
  path: string;
  user: string;
  success: boolean;
  error?: string;
}

// Constants
const ASSETS_ROOT = '/assets';
const METADATA_KEY = 'file_system_metadata';
const ACTIVITY_LOG_KEY = 'file_system_activity_log';
const MAX_LOG_ENTRIES = 1000;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/json'
];

// File system utilities
class LocalFileStorage {
  private metadata: Map<string, FileMetadata> = new Map();
  private activityLog: FileSystemActivity[] = [];
  private initialized = false;

  /**
   * Initialize the local file storage system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadMetadata();
      await this.loadActivityLog();

      this.initialized = true;
      this.logActivity('system_init', 'system', 'system', true);
    } catch (error) {
      console.error('Failed to initialize file storage system:', error);
      throw new Error('Failed to initialize file storage system');
    }
  }

  /**
   * Load metadata from storage
   */
  private async loadMetadata(): Promise<void> {
    try {
      const stored = localStorage.getItem(METADATA_KEY);
      if (stored) {
        const metadataArray = JSON.parse(stored);
        this.metadata = new Map(
          metadataArray.map((item: any) => [
            item.id,
            {
              ...item,
              createdAt: new Date(item.createdAt),
              modifiedAt: new Date(item.modifiedAt),
            },
          ])
        );
      }
    } catch (error) {
      console.warn('Failed to load metadata, starting fresh:', error);
      this.metadata = new Map();
    }
  }

  /**
   * Save metadata to storage
   */
  private async saveMetadata(): Promise<void> {
    try {
      const metadataArray = Array.from(this.metadata.values());
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadataArray));
    } catch (error) {
      throw new Error(`Failed to save metadata: ${error}`);
    }
  }

  /**
   * Load activity log from storage
   */
  private async loadActivityLog(): Promise<void> {
    try {
      const stored = localStorage.getItem(ACTIVITY_LOG_KEY);
      if (stored) {
        const logArray = JSON.parse(stored);
        this.activityLog = logArray.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
    } catch (error) {
      console.warn('Failed to load activity log, starting fresh:', error);
      this.activityLog = [];
    }
  }

  /**
   * Save activity log to storage
   */
  private async saveActivityLog(): Promise<void> {
    try {
      if (this.activityLog.length > MAX_LOG_ENTRIES) {
        this.activityLog = this.activityLog.slice(-MAX_LOG_ENTRIES);
      }
      localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(this.activityLog));
    } catch (error) {
      console.warn('Failed to save activity log:', error);
    }
  }

  /**
   * Log file system activity
   */
  private logActivity(action: string, path: string, user: string, success: boolean, error?: string): void {
    const activity: FileSystemActivity = {
      timestamp: new Date(),
      action,
      path,
      user,
      success,
      error,
    };
    this.activityLog.push(activity);
    this.saveActivityLog().catch(console.error);
  }

  /**
   * Convert file to base64 for storage
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]); // Remove data URL prefix
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert base64 to Blob
   */
  private base64ToBlob(base64: string, type: string): Blob {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type });
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  private async cleanupOldFiles(excludeFileId?: string): Promise<boolean> {
    const items = Array.from(this.metadata.values())
      .filter(m => m.type === 'file' && m.id !== excludeFileId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (items.length === 0) return false;
    const victim = items[0];
    const chunkCount = victim.chunkCount || 0;
    for (let i = 0; i < chunkCount; i++) {
      localStorage.removeItem(`virtual_file_${victim.id}_chunk_${i}`);
    }
    localStorage.removeItem(`virtual_file_${victim.id}`);
    if (victim.storageMethod === 'indexedDB') {
      try { await idb.deleteBlob(victim.id); } catch {}
    }
    this.metadata.delete(victim.id);
    await this.saveMetadata();
    this.logActivity('auto_cleanup', victim.path, 'system', true);
    return true;
  }

  /**
   * Upload a file to the local storage system
   */
  async uploadFile(
    file: File,
    path: string,
    uploadedBy: string,
    onProgress?: (p: { loadedBytes: number; totalBytes: number; chunkIndex: number; chunkCount: number; method: 'localStorage'|'indexedDB' }) => void
  ): Promise<FileMetadata> {
    await this.initialize();

    try {
      const t0 = performance.now();
      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error('Unsupported file type');
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error('File exceeds 50MB limit');
      }
      let normalizedPath = path.startsWith(ASSETS_ROOT)
        ? path
        : path === '/'
        ? ASSETS_ROOT
        : `${ASSETS_ROOT}/${path.replace(/^\/+/, '')}`;

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `${normalizedPath}/${file.name}`;
      const totalBytes = file.size;
      const chunkCount = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE_BYTES));
      let usedMethod: 'localStorage' | 'indexedDB' = 'localStorage';
      let loadedBytes = 0;
      const maxRetries = 2;

      if (chunkCount === 1) {
        const base64 = await this.blobToBase64(file);
        const key = `virtual_file_${fileId}`;
        const payload = { data: base64, name: file.name, type: file.type, size: file.size, path: filePath };
        try {
          localStorage.setItem(key, JSON.stringify(payload));
          loadedBytes = totalBytes;
          onProgress?.({ loadedBytes, totalBytes, chunkIndex: 0, chunkCount, method: 'localStorage' });
        } catch (err) {
          const ok = await this.cleanupOldFiles(fileId);
          if (ok) {
            try {
              localStorage.setItem(key, JSON.stringify(payload));
              loadedBytes = totalBytes;
              onProgress?.({ loadedBytes, totalBytes, chunkIndex: 0, chunkCount, method: 'localStorage' });
            } catch {
              usedMethod = 'indexedDB';
            }
          } else {
            usedMethod = 'indexedDB';
          }
          if (usedMethod === 'indexedDB') {
            await idb.putBlob(fileId, file);
            loadedBytes = totalBytes;
            onProgress?.({ loadedBytes, totalBytes, chunkIndex: 0, chunkCount, method: 'indexedDB' });
          }
        }
      } else {
        for (let i = 0; i < chunkCount; i++) {
          const start = i * CHUNK_SIZE_BYTES;
          const end = Math.min(start + CHUNK_SIZE_BYTES, totalBytes);
          const chunk = file.slice(start, end);
          const base64 = await this.blobToBase64(chunk);
          const key = `virtual_file_${fileId}_chunk_${i}`;
          const payload = { data: base64, index: i, total: chunkCount, type: file.type };
          let attempt = 0;
          let stored = false;
          while (attempt <= maxRetries && !stored) {
            try {
              localStorage.setItem(key, JSON.stringify(payload));
              stored = true;
            } catch (err) {
              const cleaned = await this.cleanupOldFiles(fileId);
              if (!cleaned) {
                attempt++;
                if (attempt > maxRetries) break;
                await new Promise(r => setTimeout(r, 50));
              }
            }
          }
          if (!stored) {
            for (let j = 0; j < i; j++) {
              localStorage.removeItem(`virtual_file_${fileId}_chunk_${j}`);
            }
            await idb.putBlob(fileId, file);
            usedMethod = 'indexedDB';
            loadedBytes = totalBytes;
            onProgress?.({ loadedBytes, totalBytes, chunkIndex: i, chunkCount, method: 'indexedDB' });
            break;
          } else {
            loadedBytes = end;
            onProgress?.({ loadedBytes, totalBytes, chunkIndex: i, chunkCount, method: 'localStorage' });
          }
        }
      }

      const metadata: FileMetadata = {
        id: fileId,
        name: file.name,
        path: filePath,
        type: 'file',
        size: file.size,
        createdAt: new Date(),
        modifiedAt: new Date(),
        uploadedBy,
        permissions: {
          read: [uploadedBy],
          write: [uploadedBy],
          delete: [uploadedBy],
        },
        storageMethod: usedMethod,
        chunkCount: usedMethod === 'localStorage' ? chunkCount : 0,
      };

      this.metadata.set(fileId, metadata);
      await this.saveMetadata();

      this.logActivity('upload', metadata.path, uploadedBy, true);
      const durationMs = Math.round(performance.now() - t0);
      this.logActivity('upload_perf', metadata.path, uploadedBy, true, `method=${usedMethod}; size=${file.size}; duration_ms=${durationMs}`);
      return metadata;
    } catch (error) {
      this.logActivity('upload', `${path}/${file.name}`, uploadedBy, false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string, requestedBy: string): Promise<{ blob: Blob; metadata: FileMetadata }> {
    await this.initialize();

    const metadata = this.metadata.get(fileId);
    if (!metadata) throw new Error('File not found');
    let blob: Blob | null = null;
    if (metadata.storageMethod === 'indexedDB') {
      blob = await idb.getBlob(fileId);
      if (!blob) throw new Error('File data not found');
    } else {
      const chunkCount = metadata.chunkCount || 0;
      if (chunkCount > 1) {
        const chunks: Blob[] = [];
        for (let i = 0; i < chunkCount; i++) {
          const chunkStr = localStorage.getItem(`virtual_file_${fileId}_chunk_${i}`);
          if (!chunkStr) throw new Error('Missing chunk');
          const payload = JSON.parse(chunkStr);
          chunks.push(this.base64ToBlob(payload.data, metadata.type));
        }
        blob = new Blob(chunks, { type: metadata.type });
      } else {
        const virtualFileKey = `virtual_file_${fileId}`;
        const fileDataString = localStorage.getItem(virtualFileKey);
        if (!fileDataString) throw new Error('File data not found');
        const fileData = JSON.parse(fileDataString);
        blob = this.base64ToBlob(fileData.data, fileData.type);
      }
    }

    this.logActivity('download', metadata.path, requestedBy, true);
    return { blob: blob!, metadata };
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, deletedBy: string): Promise<void> {
    await this.initialize();

    const metadata = this.metadata.get(fileId);
    if (!metadata) throw new Error('File not found');
    localStorage.removeItem(`virtual_file_${fileId}`);
    const chunkCount = metadata.chunkCount || 0;
    for (let i = 0; i < chunkCount; i++) {
      localStorage.removeItem(`virtual_file_${fileId}_chunk_${i}`);
    }
    if (metadata.storageMethod === 'indexedDB') {
      try { await idb.deleteBlob(fileId); } catch {}
    }
    this.metadata.delete(fileId);
    await this.saveMetadata();

    this.logActivity('delete', metadata.path, deletedBy, true);
  }

  /**
   * Create a directory
   */
  async createDirectory(path: string, createdBy: string): Promise<void> {
    await this.initialize();

    try {
      if (!path.startsWith(ASSETS_ROOT)) throw new Error(`Path must start with ${ASSETS_ROOT}`);
      const normalizedPath = path === ASSETS_ROOT ? ASSETS_ROOT : path.replace(/\/$/, '');

      const dirId = `dir_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const dirMetadata: FileMetadata = {
        id: dirId,
        name: normalizedPath.split('/').pop() || 'assets',
        path: normalizedPath,
        type: 'directory',
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
        uploadedBy: createdBy,
        permissions: {
          read: [createdBy],
          write: [createdBy],
          delete: [createdBy],
        },
      };

      this.metadata.set(dirId, dirMetadata);
      await this.saveMetadata();

      this.logActivity('create_directory', normalizedPath, createdBy, true);
    } catch (error) {
      this.logActivity('create_directory', path, createdBy, false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to create directory: ${error}`);
    }
  }

  /**
   * Delete a directory and its contents
   */
  async deleteDirectory(path: string, deletedBy: string): Promise<void> {
    await this.initialize();

    if (!path.startsWith(ASSETS_ROOT)) throw new Error(`Path must start with ${ASSETS_ROOT}`);
    if (path === ASSETS_ROOT) throw new Error('Cannot delete root directory');

    const itemsToDelete: string[] = [];
    for (const [fileId, metadata] of this.metadata) {
      if (metadata.path === path || metadata.path.startsWith(path + '/')) {
        itemsToDelete.push(fileId);
      }
    }

    for (const fileId of itemsToDelete) {
      const m = this.metadata.get(fileId);
      if (m?.type === 'file') {
        localStorage.removeItem(`virtual_file_${fileId}`);
        const chunkCount = m.chunkCount || 0;
        for (let i = 0; i < chunkCount; i++) {
          localStorage.removeItem(`virtual_file_${fileId}_chunk_${i}`);
        }
        if (m.storageMethod === 'indexedDB') {
          try { await idb.deleteBlob(fileId); } catch {}
        }
      }
      this.metadata.delete(fileId);
    }

    await this.saveMetadata();
    this.logActivity('delete_directory', path, deletedBy, true);
  }

  /**
   * List directory contents
   */
  async listDirectory(path: string): Promise<DirectoryEntry[]> {
    await this.initialize();

    if (!path.startsWith(ASSETS_ROOT)) throw new Error(`Path must start with ${ASSETS_ROOT}`);

    const entries: DirectoryEntry[] = [];
    const seen = new Set<string>();

    for (const metadata of this.metadata.values()) {
      if (metadata.type === 'file' && metadata.path.startsWith(path + '/')) {
        const fileDir = metadata.path.substring(0, metadata.path.lastIndexOf('/'));
        if (fileDir === path) {
          entries.push({
            name: metadata.name,
            path: metadata.path,
            type: 'file',
            size: metadata.size,
            modifiedAt: metadata.modifiedAt,
          });
        } else {
          const relativePath = fileDir.substring(path.length + 1);
          const firstLevelDir = relativePath.split('/')[0];
          const dirPath = `${path}/${firstLevelDir}`;
          if (!seen.has(dirPath)) {
            seen.add(dirPath);
            entries.push({ name: firstLevelDir, path: dirPath, type: 'directory' });
          }
        }
      }
    }

    return entries.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1
    );
  }

  async searchFiles(query: string): Promise<FileMetadata[]> {
    await this.initialize();
    const lower = query.toLowerCase();
    return Array.from(this.metadata.values()).filter(
      f => f.name.toLowerCase().includes(lower) || f.path.toLowerCase().includes(lower)
    );
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    await this.initialize();
    return this.metadata.get(fileId) || null;
  }

  getActivityLog(limit?: number): FileSystemActivity[] {
    const logs = this.activityLog;
    return limit ? logs.slice(-limit) : logs;
  }

  async getFolders(): Promise<string[]> {
    await this.initialize();
    const folders = new Set<string>();
    folders.add(ASSETS_ROOT);

    for (const m of this.metadata.values()) {
      if (m.type === 'directory') folders.add(m.path);
      else if (m.type === 'file') {
        let currentPath = m.path;
        while (currentPath.includes('/')) {
          const lastSlash = currentPath.lastIndexOf('/');
          if (lastSlash > 0) {
            currentPath = currentPath.substring(0, lastSlash);
            if (currentPath.startsWith(ASSETS_ROOT)) folders.add(currentPath);
          } else break;
        }
      }
    }
    return Array.from(folders).sort();
  }

  async updateFilePermissions(fileId: string, permissions: FilePermissions, updatedBy: string): Promise<void> {
    await this.initialize();

    const metadata = this.metadata.get(fileId);
    if (!metadata) throw new Error('File not found');
    if (!metadata.permissions.write.includes(updatedBy)) throw new Error('Insufficient permissions');

    metadata.permissions = permissions;
    metadata.modifiedAt = new Date();
    await this.saveMetadata();

    this.logActivity('update_permissions', metadata.path, updatedBy, true);
  }

  async getFileByPath(path: string): Promise<FileMetadata | null> {
    await this.initialize();
    for (const m of this.metadata.values()) if (m.path === path) return m;
    return null;
  }

  async clearAllData(): Promise<void> {
    await this.initialize();
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('virtual_file_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    localStorage.removeItem(METADATA_KEY);
    localStorage.removeItem(ACTIVITY_LOG_KEY);
    this.metadata.clear();
    this.activityLog = [];

    this.logActivity('clear_all', '/', 'system', true);
  }
}

// Singleton instance
export const localFileStorage = new LocalFileStorage();

// Convenience exports
export const uploadFile = (
  file: File,
  path: string,
  uploadedBy: string,
  onProgress?: (p: { loadedBytes: number; totalBytes: number; chunkIndex: number; chunkCount: number; method: 'localStorage'|'indexedDB' }) => void
) => localFileStorage.uploadFile(file, path, uploadedBy, onProgress);
export const downloadFile = (fileId: string, requestedBy: string) =>
  localFileStorage.downloadFile(fileId, requestedBy);
export const deleteFile = (fileId: string, deletedBy: string) =>
  localFileStorage.deleteFile(fileId, deletedBy);
export const createDirectory = (path: string, createdBy: string) =>
  localFileStorage.createDirectory(path, createdBy);
export const deleteDirectory = (path: string, deletedBy: string) =>
  localFileStorage.deleteDirectory(path, deletedBy);
export const listDirectory = (path: string) => localFileStorage.listDirectory(path);
export const searchFiles = (query: string) => localFileStorage.searchFiles(query);
export const getFolders = () => localFileStorage.getFolders();
export const updateFilePermissions = (fileId: string, permissions: FilePermissions, updatedBy: string) =>
  localFileStorage.updateFilePermissions(fileId, permissions, updatedBy);
export const getFileByPath = (path: string) => localFileStorage.getFileByPath(path);
export const clearAllData = () => localFileStorage.clearAllData();
export const getFileMetadata = (fileId: string) => localFileStorage.getFileMetadata(fileId);
export const getActivityLog = (limit?: number) => localFileStorage.getActivityLog(limit);

export default localFileStorage;
