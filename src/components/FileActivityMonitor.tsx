/**
 * File System Activity Monitor
 * Displays recent file system activities and logs
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Clock, 
  User, 
  FileText, 
  Folder, 
  Upload, 
  Download, 
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { getActivityLog, FileSystemActivity } from '@/lib/localFileStorage';
import { toast } from 'sonner';

const FileActivityMonitor = () => {
  const [activities, setActivities] = useState<FileSystemActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const log = await getActivityLog(limit);
      setActivities(log);
    } catch (error) {
      console.error('Failed to load activity log:', error);
      toast.error('Failed to load activity log');
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'upload':
        return <Upload className="h-4 w-4" />;
      case 'download':
        return <Download className="h-4 w-4" />;
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      case 'create_directory':
      case 'delete_directory':
        return <Folder className="h-4 w-4" />;
      case 'update_permissions':
        return <FileText className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (action: string) => {
    switch (action) {
      case 'upload':
      case 'create_directory':
        return 'text-green-600 bg-green-100';
      case 'download':
        return 'text-blue-600 bg-blue-100';
      case 'delete':
      case 'delete_directory':
        return 'text-red-600 bg-red-100';
      case 'update_permissions':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTimestamp = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const formatActionName = (action: string): string => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  useEffect(() => {
    loadActivities();
  }, [limit]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>File System Activity Monitor</CardTitle>
              <CardDescription>
                Monitor recent file system activities and operations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={loadActivities}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="limit" className="text-sm font-medium">Show last:</label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="border rounded-md px-3 py-1 text-sm"
              >
                <option value={25}>25 activities</option>
                <option value={50}>50 activities</option>
                <option value={100}>100 activities</option>
                <option value={200}>200 activities</option>
                <option value={500}>500 activities</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>{activities.filter(a => a.success).length} Successful</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span>{activities.filter(a => !a.success).length} Failed</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>
            {activities.length} activity{activities.length !== 1 ? 'ies' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activities found</p>
              <p className="text-sm mt-2">File system activities will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {activities.map((activity, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all hover:shadow-sm ${
                      activity.success 
                        ? 'border-green-200 bg-green-50/50' 
                        : 'border-red-200 bg-red-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-full ${getActivityColor(activity.action)}`}>
                          {getActivityIcon(activity.action)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {formatActionName(activity.action)}
                            </span>
                            <Badge variant={activity.success ? "default" : "destructive"} className="text-xs">
                              {activity.success ? 'Success' : 'Failed'}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3" />
                              <span className="truncate" title={activity.path}>
                                {activity.path}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{activity.user}</span>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatTimestamp(activity.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                          
                          {activity.error && (
                            <Alert variant="destructive" className="mt-2 text-xs">
                              <AlertDescription>{activity.error}</AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Activity Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Statistics</CardTitle>
          <CardDescription>Summary of file system operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {activities.filter(a => a.action === 'upload' && a.success).length}
              </div>
              <div className="text-sm text-green-700">Uploads</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {activities.filter(a => a.action === 'download' && a.success).length}
              </div>
              <div className="text-sm text-blue-700">Downloads</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {activities.filter(a => a.action === 'create_directory' && a.success).length}
              </div>
              <div className="text-sm text-yellow-700">Directories Created</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {activities.filter(a => a.action === 'delete' && a.success).length}
              </div>
              <div className="text-sm text-red-700">Deletions</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileActivityMonitor;