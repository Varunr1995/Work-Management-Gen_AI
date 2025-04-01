import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, BellRingIcon, CheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Notification } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  useQuery, 
  useMutation 
} from '@tanstack/react-query';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

export const NotificationsPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('unread');
  
  // Get the current user ID (for our admin user)
  // In a real app you would get this from auth context, but here we use Alex's ID (1) which has admin role
  const userId = 1; // Admin user (Alex)
  
  // Get all notifications for the current user
  const { data: notifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', userId, activeTab],
    queryFn: async () => {
      const endpoint = activeTab === 'unread' 
        ? `/api/notifications/unread/${userId}` 
        : `/api/notifications/${userId}`;
      return fetch(endpoint).then(res => res.json());
    }
  });

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(
        'PATCH', 
        `/api/notifications/${notificationId}/read`
      );
    },
    onSuccess: () => {
      // Invalidate the notifications queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  // Mark all notifications as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      return apiRequest(
        'PATCH', 
        `/api/notifications/mark-all-read/${userId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }
  });

  // Count unread notifications
  const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;

  // Format the notification date
  const formatDate = (date: Date) => {
    if (!date) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000 / 60);
    
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    
    return `${days} days ago`;
  };

  // Auto refresh notifications
  useEffect(() => {
    const interval = setInterval(() => {
      if (open) {
        refetch();
      }
    }, 30000); // Refresh every 30 seconds if panel is open
    
    return () => clearInterval(interval);
  }, [open, refetch]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          {unreadCount > 0 ? (
            <>
              <BellRingIcon className="h-5 w-5" />
              <Badge
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            </>
          ) : (
            <BellIcon className="h-5 w-5" />
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Card className="border-0">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex gap-1 text-sm">
                <Button 
                  variant={activeTab === 'unread' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setActiveTab('unread')}
                >
                  Unread
                </Button>
                <Button 
                  variant={activeTab === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setActiveTab('all')}
                >
                  All
                </Button>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <ScrollArea className="h-[300px]">
            <CardContent className="p-0">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No {activeTab === 'unread' ? 'unread ' : ''}notifications
                </div>
              ) : (
                <ul className="divide-y">
                  {notifications.map((notification: Notification) => (
                    <li key={notification.id} className={`p-3 hover:bg-gray-50 ${!notification.isRead ? 'bg-blue-50' : ''}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 mr-2">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-sm text-gray-600">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(notification.createdAt as Date)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 w-6 p-0 rounded-full"
                            onClick={() => markAsRead.mutate(notification.id)}
                          >
                            <CheckIcon className="h-4 w-4" />
                            <span className="sr-only">Mark as read</span>
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </ScrollArea>
          <Separator />
          <CardFooter className="flex justify-end p-2">
            {unreadCount > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => markAllAsRead.mutate()}
              >
                Mark all as read
              </Button>
            )}
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  );
};