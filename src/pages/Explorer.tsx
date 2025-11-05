import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout, isAdmin } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, Search, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import FileExplorer from '@/components/FileExplorer';

const Explorer = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }
    setUsername(user.username);
    setUserIsAdmin(isAdmin());
  }, [navigate]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">File Explorer</h1>
                <p className="text-sm text-muted-foreground">Welcome, {username}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {userIsAdmin && (
                <Button onClick={goToDashboard} variant="outline">
                  Admin Dashboard
                </Button>
              )}
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search files across all folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      {/* File Explorer */}
      <main className="container mx-auto px-4 py-8">
        <FileExplorer searchQuery={searchQuery} isAdmin={userIsAdmin} username={username} />
      </main>
    </div>
  );
};

export default Explorer;
