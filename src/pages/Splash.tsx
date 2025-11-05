import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';

const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center">
      <div className="text-center space-y-6 animate-in fade-in duration-1000">
        <div className="flex justify-center">
          <div className="relative">
            <FolderOpen className="w-24 h-24 text-primary animate-pulse" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          </div>
        </div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          File Manager 2025
        </h1>
        <p className="text-muted-foreground text-lg">Organizing your digital world...</p>
      </div>
    </div>
  );
};

export default Splash;
