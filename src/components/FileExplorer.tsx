import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Folder, File, Download, Trash2, ChevronRight, Home } from 'lucide-react';
import { getAllFiles, deleteFile, downloadFile, searchFiles, getFolders, type StoredFile } from '@/lib/fileStorage';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface FileExplorerProps {
  searchQuery: string;
  isAdmin: boolean;
  username: string;
}

const FileExplorer = ({ searchQuery, isAdmin, username }: FileExplorerProps) => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [filteredFiles, setFilteredFiles] = useState<StoredFile[]>([]);

  const loadData = async () => {
    const allFiles = await getAllFiles();
    const allFolders = await getFolders();
    setFiles(allFiles);
    setFolders(['/', ...allFolders]);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const filterFiles = async () => {
      if (searchQuery) {
        const results = await searchFiles(searchQuery);
        setFilteredFiles(results);
      } else {
        const currentFiles = files.filter(f => f.path === currentPath);
        setFilteredFiles(currentFiles);
      }
    };
    filterFiles();
  }, [searchQuery, files, currentPath]);

  const handleDelete = async (id: string) => {
    try {
      await deleteFile(id);
      toast.success('File deleted successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  const handleDownload = (file: StoredFile) => {
    downloadFile(file);
    toast.success('Download started');
  };

  const navigateToFolder = (folder: string) => {
    setCurrentPath(folder);
  };

  const getSubfolders = (path: string) => {
    const pathDepth = path === '/' ? 0 : path.split('/').filter(Boolean).length;
    return folders.filter(f => {
      if (f === '/') return false;
      const parentPath = f.substring(0, f.lastIndexOf('/')) || '/';
      return parentPath === path;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Breadcrumb navigation
  const pathParts = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      {!searchQuery && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPath('/')}
                className="h-8"
              >
                <Home className="w-4 h-4" />
              </Button>
              {pathParts.map((part, index) => {
                const path = '/' + pathParts.slice(0, index + 1).join('/');
                return (
                  <div key={path} className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPath(path)}
                      className="h-8"
                    >
                      {part}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results Header */}
      {searchQuery && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {filteredFiles.length} file(s) matching "{searchQuery}"
              </p>
              <Button variant="ghost" size="sm" onClick={() => setCurrentPath('/')}>
                Clear Search
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folders */}
      {!searchQuery && getSubfolders(currentPath).length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase">Folders</h3>
            <div className="grid gap-2">
              {getSubfolders(currentPath).map((folder) => (
                <Button
                  key={folder}
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => navigateToFolder(folder)}
                >
                  <Folder className="w-5 h-5 mr-3 text-primary" />
                  <span className="font-medium">{folder.split('/').pop()}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files */}
      <Card>
        <CardContent className="py-4">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase">
            {searchQuery ? 'Search Results' : 'Files'}
          </h3>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{searchQuery ? 'No files found' : 'No files in this folder'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <File className="w-5 h-5 text-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {searchQuery && (
                          <Badge variant="outline" className="text-xs">
                            {file.path}
                          </Badge>
                        )}
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{formatDate(file.uploadDate)}</span>
                        <span>•</span>
                        <span>By {file.uploadedBy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(file.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FileExplorer;
