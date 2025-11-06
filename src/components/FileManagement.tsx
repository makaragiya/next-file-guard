import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FolderPlus, Folder, Activity } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';
import { getFolders, uploadFile, createDirectory } from '@/lib/localFileStorage';
import LocalFileExplorer from './LocalFileExplorer';
import FileActivityMonitor from './FileActivityMonitor';

const FileManagement = () => {
  const [folders, setFolders] = useState<string[]>(['/assets']);
  const [selectedFolder, setSelectedFolder] = useState('/assets');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);

  const loadFolders = async () => {
    try {
      const allFolders = await getFolders();
      // Ensure all folder paths start with /assets
      const normalizedFolders = allFolders.map(folder => 
        folder.startsWith('/assets') ? folder : `/assets${folder}`
      );
      // Use Set to remove duplicates and ensure /assets is first
      const uniqueFolders = Array.from(new Set(['/assets', ...normalizedFolders]));
      setFolders(uniqueFolders);
    } catch (error) {
      console.error('Failed to load folders:', error);
      toast.error('Failed to load folders');
      setFolders(['/assets']);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      toast.error('Not authenticated');
      return;
    }

    try {
      // Ensure the path starts with /assets
      const fullPath = selectedFolder.startsWith('/assets') ? selectedFolder : `/assets${selectedFolder}`;
      await uploadFile(selectedFile, fullPath, user.username);
      toast.success('File uploaded successfully');
      setSelectedFile(null);
      setIsUploadOpen(false);
      loadFolders();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFolderName) {
      toast.error('Please enter a folder name');
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      toast.error('Not authenticated');
      return;
    }

    try {
      // Ensure the path starts with /assets
      const basePath = selectedFolder.startsWith('/assets') ? selectedFolder : `/assets${selectedFolder}`;
      const newFolderPath = basePath === '/assets/' 
        ? `/assets/${newFolderName}` 
        : `${basePath}/${newFolderName}`;

      await createDirectory(newFolderPath, user.username);
      
      // Use Set to add new folder and ensure uniqueness
      const updatedFolders = Array.from(new Set([...folders, newFolderPath]));
      setFolders(updatedFolders);
      setNewFolderName('');
      setIsFolderOpen(false);
      toast.success('Folder created successfully');
    } catch (error) {
      console.error('Create folder error:', error);
      toast.error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="explorer" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="explorer">
            <Folder className="w-4 h-4 mr-2" />
            File Explorer
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload & Create
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity Monitor
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="explorer">
          <LocalFileExplorer currentPath="/assets" />
        </TabsContent>
        
        <TabsContent value="upload">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Upload Files</CardTitle>
                <CardDescription>Upload files to the file system</CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload File
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload File</DialogTitle>
                      <DialogDescription>
                        Select a file and destination folder
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleFileUpload} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="file">File</Label>
                        <Input
                          id="file"
                          type="file"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="folder">Destination Folder</Label>
                        <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {folders.map((folder) => (
                              <SelectItem key={folder} value={folder}>
                                {folder === '/assets' ? '🏠 Home' : folder}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full">Upload</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create Folder</CardTitle>
                <CardDescription>Organize files into folders</CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={isFolderOpen} onOpenChange={setIsFolderOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <FolderPlus className="w-4 h-4 mr-2" />
                      New Folder
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Folder</DialogTitle>
                      <DialogDescription>
                        Create a new folder in the file system
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateFolder} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="parent">Parent Folder</Label>
                        <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {folders.map((folder) => (
                              <SelectItem key={folder} value={folder}>
                                {folder === '/assets' ? '🏠 Home' : folder}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="folder-name">Folder Name</Label>
                        <Input
                          id="folder-name"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Enter folder name"
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full">Create Folder</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="activity">
          <FileActivityMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FileManagement;
