/**
 * Local File Explorer Component
 * Provides a comprehensive interface for browsing and managing files in the local storage system
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FolderPlus, 
  File, 
  Folder, 
  Download, 
  Trash2, 
  Search,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';
import { 
  listDirectory, 
  downloadFile, 
  deleteFile, 
  searchFiles,
  getFileMetadata,
  uploadFile,
  createDirectory,
  DirectoryEntry,
  FileMetadata,
  deleteDirectory,
  getFolders
} from '@/lib/localFileStorage';
import { getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';

interface LocalFileExplorerProps {
  currentPath?: string;
  onPathChange?: (path: string) => void;
}

const LocalFileExplorer = ({ currentPath = '/assets', onPathChange }: LocalFileExplorerProps) => {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [pathHistory, setPathHistory] = useState<string[]>([currentPath]);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [selectedUploadFolder, setSelectedUploadFolder] = useState<string>(currentPath);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    loadedBytes: number;
    totalBytes: number;
    chunkIndex: number;
    chunkCount: number;
    method: 'localStorage' | 'indexedDB';
  } | null>(null);

  const loadDirectory = async (path: string) => {
    setIsLoading(true);
    try {
      const directoryEntries = await listDirectory(path);
      setEntries(directoryEntries);
    } catch (error) {
      console.error('Failed to load directory:', error);
      toast.error(`Failed to load directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableFolders = async () => {
    try {
      const folders = await getFolders();
      setAvailableFolders(folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
      setAvailableFolders([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadDirectory(currentPath);
      return;
    }

    setIsLoading(true);
    try {
      const searchResults = await searchFiles(searchQuery);
      // Convert FileMetadata to DirectoryEntry format
      const searchEntries: DirectoryEntry[] = searchResults.map(file => ({
        name: file.name,
        path: file.path,
        type: 'file' as const,
        size: file.size,
        modifiedAt: file.modifiedAt
      }));
      setEntries(searchEntries);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    // Prevent uploading files larger than 4MB
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > MAX_FILE_SIZE) {
        toast.error('File is too large. Maximum size is 50MB.');
        return;
      }

    const user = getCurrentUser();
    if (!user) {
      toast.error('Not authenticated');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(null);
      await uploadFile(selectedFile, selectedUploadFolder, user.username, (p) => {
        setUploadProgress(p);
      });
      
      toast.success('File uploaded successfully');
      setSelectedFile(null);
      setUploadProgress(null);
      setIsUploading(false);
      setIsUploadOpen(false);
      loadDirectory(selectedUploadFolder);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsUploading(false);
    }
  };

  const handleDownload = async (entry: DirectoryEntry) => {
    if (entry.type !== 'file') return;

    try {
      // Get file metadata first to get the file ID
      const searchResults = await searchFiles(entry.name);
      const fileMetadata = searchResults.find(f => f.path === entry.path);
      
      if (!fileMetadata) {
        toast.error('File metadata not found');
        return;
      }

      const user = getCurrentUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }
      const { blob, metadata } = await downloadFile(fileMetadata.id, user.username);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = metadata.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('File downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (entry: DirectoryEntry) => {
    const user = getCurrentUser();
    if (!user) {
      toast.error('Not authenticated');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${entry.name}"?`)) {
      return;
    }

    try {
      if (entry.type === 'file') {
        // Get file metadata first to get the file ID
        const searchResults = await searchFiles(entry.name);
        const fileMetadata = searchResults.find(f => f.path === entry.path);
        
        if (!fileMetadata) {
          toast.error('File metadata not found');
          return;
        }

        await deleteFile(fileMetadata.id, user.username);
      } else {
        // Handle directory deletion
        await deleteDirectory(entry.path, user.username);
      }
      
      toast.success(`${entry.type === 'file' ? 'File' : 'Directory'} deleted successfully`);
      loadDirectory(currentPath);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(`Failed to delete ${entry.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const navigateToPath = (newPath: string) => {
    setCurrentPathIndex(pathHistory.length);
    setPathHistory([...pathHistory, newPath]);
    if (onPathChange) {
      onPathChange(newPath);
    }
  };

  const navigateBack = () => {
    if (currentPathIndex > 0) {
      const newIndex = currentPathIndex - 1;
      setCurrentPathIndex(newIndex);
      const newPath = pathHistory[newIndex];
      if (onPathChange) {
        onPathChange(newPath);
      }
    }
  };

  const navigateForward = () => {
    if (currentPathIndex < pathHistory.length - 1) {
      const newIndex = currentPathIndex + 1;
      setCurrentPathIndex(newIndex);
      const newPath = pathHistory[newIndex];
      if (onPathChange) {
        onPathChange(newPath);
      }
    }
  };

  const navigateUp = () => {
    if (currentPath !== '/assets') {
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/assets';
      navigateToPath(parentPath);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date?: Date): string => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      loadDirectory(currentPath);
    }
  }, [searchQuery, currentPath]);

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <Card>
        <CardHeader>
          <CardTitle>Local File Explorer</CardTitle>
          <CardDescription>Browse and manage files in the local storage system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} size="icon" variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Navigation controls */}
            <div className="flex gap-2">
              {/* <Button onClick={navigateBack} size="icon" variant="outline" disabled={currentPathIndex === 0}>
                <RefreshCw className="h-4 w-4 rotate-180" />
              </Button>
              <Button onClick={navigateForward} size="icon" variant="outline" disabled={currentPathIndex === pathHistory.length - 1}>
                <RefreshCw className="h-4 w-4" />
              </Button> */}
              <Button onClick={navigateUp} size="icon" variant="outline" disabled={currentPath === '/assets'}>
                <FolderPlus className="h-4 w-4" />
              </Button>
              <Button onClick={() => loadDirectory(currentPath)} size="icon" variant="outline">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Upload button */}
            <Dialog open={isUploadOpen} onOpenChange={(open) => {
              setIsUploadOpen(open);
              if (open) {
                loadAvailableFolders();
                setSelectedUploadFolder(currentPath);
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload File</DialogTitle>
                  <DialogDescription>
                    Choose a file and select the destination folder
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="upload-folder">Destination Folder</Label>
                    <select
                      id="upload-folder"
                      value={selectedUploadFolder}
                      onChange={(e) => setSelectedUploadFolder(e.target.value)}
                      className="w-full p-2 border rounded-md bg-background"
                    >
                      {availableFolders.map(folder => (
                        <option key={folder} value={folder}>
                          {folder === '/assets' ? '🏠 Home' : folder}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">Select File</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Max size: 50MB. Allowed types: PNG, JPEG, GIF, PDF, TXT, CSV, JSON.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={!selectedFile || isUploading}>
                    {isUploading ? 'Uploading…' : 'Upload File'}
                  </Button>
                  {uploadProgress && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {Math.round((uploadProgress.loadedBytes / uploadProgress.totalBytes) * 100)}% • {uploadProgress.method}
                        </span>
                        <span>
                          Chunk {uploadProgress.chunkIndex + 1} / {uploadProgress.chunkCount}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded">
                        <div
                          className="h-2 bg-primary rounded"
                          style={{ width: `${Math.round((uploadProgress.loadedBytes / uploadProgress.totalBytes) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </form>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Current path display */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Current Path:</div>
            <div className="font-mono text-sm">
              {currentPath === '/assets' ? '🏠 Home' : currentPath}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription>Loading directory contents...</AlertDescription>
        </Alert>
      )}

      {/* Directory contents */}
      <Card>
        <CardHeader>
          <CardTitle>Directory Contents</CardTitle>
          <CardDescription>
            {entries.length} item{entries.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No files or directories found</p>
              <p className="text-sm mt-2">Upload a file or create a new directory to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {entry.type === 'directory' ? (
                      <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    ) : (
                      <File className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{entry.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {entry.type === 'file' ? formatFileSize(entry.size) : 'Directory'}
                        {entry.modifiedAt && ` • ${formatDate(entry.modifiedAt)}`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {entry.type === 'directory' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigateToPath(entry.path)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(entry)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(entry)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error handling */}
      <Alert variant="destructive" className="hidden">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error messages will appear here
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default LocalFileExplorer;