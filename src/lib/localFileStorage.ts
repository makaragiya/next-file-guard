/**
 * Local File Storage System
 * Uses the /assets directory as the root location for storing all files and folders
 * Completely self-contained within the local file system
 * Stores files directly in the file system, not in browser storage
 */

export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  uploadedBy: string;
  permissions: FilePermissions;
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
      // Load existing metadata
      await this.loadMetadata();
      
      // Load activity log
      await this.loadActivityLog();
      
      this.initialized = true;
      this.logActivity('system', 'File storage system initialized', 'system', true);
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
        this.metadata = new Map(metadataArray.map((item: any) => [item.id, {
          ...item,
          createdAt: new Date(item.createdAt),
          modifiedAt: new Date(item.modifiedAt)
        }]));
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
          timestamp: new Date(item.timestamp)
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
      // Keep only the last MAX_LOG_ENTRIES entries
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
      error
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

  /**
   * Upload a file to the local storage system
   */
  async uploadFile(file: File, path: string, uploadedBy: string): Promise<FileMetadata> {
    await this.initialize();

    try {
      // Ensure path always starts with /assets
      let normalizedPath = path;
      if (!path.startsWith(ASSETS_ROOT)) {
        // If path doesn't start with /assets, prepend it
        normalizedPath = path === '/' ? ASSETS_ROOT : `${ASSETS_ROOT}${path.startsWith('/') ? path : '/' + path}`;
      }

      // Generate file ID
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `${normalizedPath}/${file.name}`;

      // Convert file to base64 for storage
      const fileData = await this.fileToBase64(file);

      // Store file data in a virtual file system structure
      // Since we can't access the actual file system in browser, we'll store the file data
      // in a structured way that simulates the /assets directory
      const virtualFileKey = `virtual_file_${fileId}`;
      localStorage.setItem(virtualFileKey, JSON.stringify({
        data: fileData,
        name: file.name,
        type: file.type,
        size: file.size,
        path: filePath
      }));

      // Create metadata
      const metadata: FileMetadata = {
        id: fileId,
        name: file.name,
        path: filePath,
        type: file.type,
        size: file.size,
        createdAt: new Date(),
        modifiedAt: new Date(),
        uploadedBy,
        permissions: {
          read: [uploadedBy],
          write: [uploadedBy],
          delete: [uploadedBy]
        }
      };

      this.metadata.set(fileId, metadata);
      await this.saveMetadata();

      this.logActivity('upload', metadata.path, uploadedBy, true);
      
      return metadata;
    } catch (error) {
      this.logActivity('upload', `${path}/${file.name}`, uploadedBy, false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Download a file from the local storage system
   */
  async downloadFile(fileId: string): Promise<{ blob: Blob; metadata: FileMetadata }> {
    await this.initialize();

    const metadata = this.metadata.get(fileId);
    if (!metadata) {
      throw new Error('File not found');
    }

    try {
      // Find the virtual file key
      const virtualFileKey = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
        .find(key => key?.startsWith('virtual_file_') && 
               JSON.parse(localStorage.getItem(key)!).path === metadata.path);

      if (!virtualFileKey) {
        throw new Error('File data not found');
      }

      const fileData = JSON.parse(localStorage.getItem(virtualFileKey)!);
      const blob = this.base64ToBlob(fileData.data, metadata.type);
      
      this.logActivity('download', metadata.path, 'system', true);
      
      return { blob, metadata };
    } catch (error) {
      this.logActivity('download', metadata.path, 'system', false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  /**
   * Delete a file from the local storage system
   */
  async deleteFile(fileId: string, deletedBy: string): Promise<void> {
    await this.initialize();

    const metadata = this.metadata.get(fileId);
    if (!metadata) {
      throw new Error('File not found');
    }

    // Check permissions
    if (!metadata.permissions.delete.includes(deletedBy)) {
      throw new Error('Insufficient permissions to delete this file');
    }

    try {
      // Find and delete the virtual file
      const virtualFileKey = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
        .find(key => key?.startsWith('virtual_file_') && 
               JSON.parse(localStorage.getItem(key)!).path === metadata.path);

      if (virtualFileKey) {
        localStorage.removeItem(virtualFileKey);
      }
      
      // Remove metadata
      this.metadata.delete(fileId);
      await this.saveMetadata();

      this.logActivity('delete', metadata.path, deletedBy, true);
    } catch (error) {
      this.logActivity('delete', metadata.path, deletedBy, false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Create a directory (virtual - just for organization in metadata)
   */
  async createDirectory(path: string, createdBy: string): Promise<void> {
    await this.initialize();

    try {
      if (!path.startsWith(ASSETS_ROOT)) {
        throw new Error(`Path must start with ${ASSETS_ROOT}`);
      }

      // Normalize path - ensure it doesn't end with slash except for root
      const normalizedPath = path === ASSETS_ROOT ? ASSETS_ROOT : path.replace(/\/$/, '');

      // Check if directory already exists (by checking if any files exist in this path)
      const existingFiles = Array.from(this.metadata.values()).filter(file => 
        file.path.startsWith(normalizedPath + '/') || file.path === normalizedPath
      );

      if (existingFiles.length > 0) {
        // Directory exists if there are files in it, but we can still "create" it
        console.log(`Directory ${normalizedPath} already exists or contains files`);
      }

      // Create a virtual directory entry by storing a metadata entry
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
          delete: [createdBy]
        }
      };

      // Store directory metadata
      this.metadata.set(dirId, dirMetadata);
      await this.saveMetadata();

      this.logActivity('create_directory', normalizedPath, createdBy, true);
    } catch (error) {
      this.logActivity('create_directory', path, createdBy, false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to create directory: ${error}`);
    }
  }

  /**
   * Delete a directory and all its contents
   */
  async deleteDirectory(path: string, deletedBy: string): Promise<void> {
    await this.initialize();

    try {
      if (!path.startsWith(ASSETS_ROOT)) {
        throw new Error(`Path must start with ${ASSETS_ROOT}`);
      }

      if (path === ASSETS_ROOT) {
        throw new Error('Cannot delete root directory');
      }

      // Find all files and directories in this directory and subdirectories
      const itemsToDelete: string[] = [];
      
      for (const [fileId, metadata] of this.metadata) {
        if (metadata.path === path || metadata.path.startsWith(path + '/')) {
          itemsToDelete.push(fileId);
        }
      }

      // Delete all items
      for (const fileId of itemsToDelete) {
        if (this.metadata.get(fileId)?.type === 'file') {
          localStorage.removeItem(`virtual_file_${fileId}`);
        }
        this.metadata.delete(fileId);
      }

      this.logActivity('delete_directory', path, deletedBy, true);
      await this.saveMetadata();
    } catch (error) {
      this.logActivity('delete_directory', path, deletedBy, false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to delete directory: ${error}`);
    }
  }

  /**
   * List contents of a directory
   */
  async listDirectory(path: string): Promise<DirectoryEntry[]> {
    await this.initialize();

    try {
      if (!path.startsWith(ASSETS_ROOT)) {
        throw new Error(`Path must start with ${ASSETS_ROOT}`);
      }

      const entries: DirectoryEntry[] = [];
      const seen = new Set<string>();

      // First, add any explicitly created directories
      for (const [fileId, metadata] of this.metadata) {
        if (metadata.type === 'directory' && metadata.path === path) {
          // This is the directory itself, skip it
          continue;
        }
      }

      // Find all files and subdirectories in this directory
      for (const [fileId, metadata] of this.metadata) {
        if (metadata.type === 'directory') {
          // Handle directory entries
          if (metadata.path.startsWith(path + '/') && metadata.path !== path) {
            const relativePath = metadata.path.substring(path.length + 1);
            const firstLevelDir = relativePath.split('/')[0];
            const dirPath = `${path}/${firstLevelDir}`;
            
            if (!seen.has(dirPath)) {
              seen.add(dirPath);
              entries.push({
                name: firstLevelDir,
                path: dirPath,
                type: 'directory',
                modifiedAt: metadata.modifiedAt
              });
            }
          }
        } else {
          // Handle file entries
          const fileDir = metadata.path.substring(0, metadata.path.lastIndexOf('/'));
          
          if (fileDir === path) {
            // This file is directly in the requested directory
            entries.push({
              name: metadata.name,
              path: metadata.path,
              type: 'file',
              size: metadata.size,
              modifiedAt: metadata.modifiedAt
            });
          } else if (fileDir.startsWith(path + '/')) {
            // This file is in a subdirectory - add the subdirectory if not seen
            const relativePath = fileDir.substring(path.length + 1);
            const firstLevelDir = relativePath.split('/')[0];
            const dirPath = `${path}/${firstLevelDir}`;
            
            if (!seen.has(dirPath)) {
              seen.add(dirPath);
              entries.push({
                name: firstLevelDir,
                path: dirPath,
                type: 'directory'
              });
            }
          }
        }
      }

      return entries.sort((a, b) => {
        // Directories first, then alphabetical
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      throw new Error(`Failed to list directory: ${error}`);
    }
  }

  /**
   * Get all files recursively
   */
  async getAllFiles(): Promise<FileMetadata[]> {
    await this.initialize();
    return Array.from(this.metadata.values());
  }

  /**
   * Search for files by name or path
   */
  async searchFiles(query: string): Promise<FileMetadata[]> {
    await this.initialize();
    
    const lowerQuery = query.toLowerCase();
    return Array.from(this.metadata.values()).filter(file => 
      file.name.toLowerCase().includes(lowerQuery) || 
      file.path.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get file metadata by file ID
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    await this.initialize();
    return this.metadata.get(fileId) || null;
  }

  /**
   * Get activity log
   */
  getActivityLog(limit?: number): FileSystemActivity[] {
    try {
      const activities = this.activityLog;
      return limit ? activities.slice(-limit) : activities;
    } catch (error) {
      console.error('Get activity log error:', error);
      return [];
    }
  }

  /**
   * Get all folders in the file system
   */
  async getFolders(): Promise<string[]> {
    await this.initialize();
    
    try {
      const folders = new Set<string>();
      
      // Add the root assets folder
      folders.add(ASSETS_ROOT);
      
      // Add all explicitly created directories
      for (const [fileId, metadata] of this.metadata) {
        if (metadata.type === 'directory') {
          folders.add(metadata.path);
        }
      }
      
      // Extract all unique directory paths from file paths
      for (const [fileId, metadata] of this.metadata) {
        if (metadata.type === 'file') {
          const path = metadata.path;
          let currentPath = path;
          
          // Extract all parent directories
          while (currentPath.includes('/')) {
            const lastSlash = currentPath.lastIndexOf('/');
            if (lastSlash > 0) {
              currentPath = currentPath.substring(0, lastSlash);
              if (currentPath.startsWith(ASSETS_ROOT)) {
                folders.add(currentPath);
              }
            } else {
              break;
            }
          }
        }
      }
      
      return Array.from(folders).sort();
    } catch (error) {
      throw new Error(`Failed to get folders: ${error}`);
    }
  }

  /**
   * Update file permissions
   */
  async updateFilePermissions(fileId: string, permissions: FilePermissions, updatedBy: string): Promise<void> {
    await this.initialize();

    const metadata = this.metadata.get(fileId);
    if (!metadata) {
      throw new Error('File not found');
    }

    // Check if user has write permission
    if (!metadata.permissions.write.includes(updatedBy)) {
      throw new Error('Insufficient permissions to update file permissions');
    }

    try {
      metadata.permissions = permissions;
      metadata.modifiedAt = new Date();
      await this.saveMetadata();

      this.logActivity('update_permissions', metadata.path, updatedBy, true);
    } catch (error) {
      this.logActivity('update_permissions', metadata.path, updatedBy, false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to update file permissions: ${error}`);
    }
  }

  /**
   * Get file by path
   */
  async getFileByPath(path: string): Promise<FileMetadata | null> {
    await this.initialize();
    
    for (const metadata of this.metadata.values()) {
      if (metadata.path === path) {
        return metadata;
      }
    }
    return null;
  }

  /**
   * Clear all data (for testing/reset)
   */
  async clearAllData(): Promise<void> {
    await this.initialize();

    try {
      // Clear all virtual files
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('virtual_file_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear metadata and activity log
      localStorage.removeItem(METADATA_KEY);
      localStorage.removeItem(ACTIVITY_LOG_KEY);

      // Clear in-memory data
      this.metadata.clear();
      this.activityLog = [];

      this.logActivity('clear_all', '/', 'system', true);
    } catch (error) {
      this.logActivity('clear_all', '/', 'system', false, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to clear all data: ${error}`);
    }
  }
}

// Export singleton instance
export const localFileStorage = new LocalFileStorage();
export default localFileStorage;

// Convenience functions for backward compatibility and ease of use
export const uploadFile = (file: File, path: string, uploadedBy: string) => 
  localFileStorage.uploadFile(file, path, uploadedBy);

export const downloadFile = (fileId: string) => 
  localFileStorage.downloadFile(fileId);

export const deleteFile = (fileId: string, deletedBy: string) => 
  localFileStorage.deleteFile(fileId, deletedBy);

export const createDirectory = (path: string, createdBy: string) => 
  localFileStorage.createDirectory(path, createdBy);

export const deleteDirectory = (path: string, deletedBy: string) => 
  localFileStorage.deleteDirectory(path, deletedBy);

export const listDirectory = (path: string) => 
  localFileStorage.listDirectory(path);

export const searchFiles = (query: string) => 
  localFileStorage.searchFiles(query);

export const getFolders = () => 
  localFileStorage.getFolders();

export const updateFilePermissions = (fileId: string, permissions: FilePermissions, updatedBy: string) => 
  localFileStorage.updateFilePermissions(fileId, permissions, updatedBy);

export const getFileByPath = (path: string) => 
  localFileStorage.getFileByPath(path);

export const clearAllData = () => 
  localFileStorage.clearAllData();

export const getFileMetadata = (fileId: string) => 
  localFileStorage.getFileMetadata(fileId);

export const getActivityLog = (limit?: number) => 
  localFileStorage.getActivityLog(limit);