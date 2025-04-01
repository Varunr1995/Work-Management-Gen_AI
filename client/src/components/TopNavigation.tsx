import { FC, useState } from 'react';
import { useTaskViews } from '@/lib/hooks';
import { Search, Bell, MessageCircle, MoreVertical, ListIcon, Kanban, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopNavigationProps {
  workspaceName: string;
  onViewChange: (view: string) => void;
  currentView: string;
}

const TopNavigation: FC<TopNavigationProps> = ({ 
  workspaceName, 
  onViewChange, 
  currentView 
}) => {
  // Views
  const { views } = useTaskViews();

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold">{workspaceName}</h2>
          <button className="ml-4 text-slate-400 hover:text-slate-600">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-slate-100 rounded-md px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white w-64"
            />
            <Search className="h-5 w-5 text-slate-400 absolute left-2 top-2" />
          </div>
          
          <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100">
            <Bell className="h-6 w-6" />
          </button>
          
          <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100">
            <MessageCircle className="h-6 w-6" />
          </button>
          
          <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100">
            <MoreVertical className="h-6 w-6" />
          </button>
        </div>
      </div>
      
      {/* View Tabs */}
      <div className="flex border-b border-slate-200">
        {views.map((view) => (
          <button
            key={view.id}
            className={cn(
              "py-3 px-6 text-sm font-medium",
              currentView === view.id
                ? "text-primary border-b-2 border-primary"
                : "text-slate-600 hover:text-primary"
            )}
            onClick={() => onViewChange(view.id)}
          >
            <div className="flex items-center">
              {view.id === 'list' && <ListIcon className="h-5 w-5 mr-1" />}
              {view.id === 'kanban' && <Kanban className="h-5 w-5 mr-1" />}
              {view.id === 'gantt' && <Calendar className="h-5 w-5 mr-1" />}
              {view.name}
            </div>
          </button>
        ))}
      </div>
    </header>
  );
};

export default TopNavigation;
