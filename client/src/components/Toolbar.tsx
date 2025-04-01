import { FC, useState } from 'react';
import { Plus, Filter, SortAsc, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User } from '@shared/schema';

interface ToolbarProps {
  onNewTask: () => void;
  teamMembers: User[];
  onFilterByUser?: (userId: number | null) => void;
}

const Toolbar: FC<ToolbarProps> = ({ onNewTask, teamMembers, onFilterByUser }) => {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const handleUserClick = (userId: number) => {
    const newUserId = selectedUserId === userId ? null : userId;
    setSelectedUserId(newUserId);
    if (onFilterByUser) {
      onFilterByUser(newUserId);
    }
  };

  const clearFilter = () => {
    setSelectedUserId(null);
    if (onFilterByUser) {
      onFilterByUser(null);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button 
          onClick={onNewTask}
          className="inline-flex items-center justify-center"
        >
          <Plus className="h-5 w-5 mr-1" />
          New Task
        </Button>
        
        <Button variant="outline" className="inline-flex items-center justify-center">
          <Filter className="h-5 w-5 mr-1" />
          Filter
        </Button>
        
        <Button variant="outline" className="inline-flex items-center justify-center">
          <SortAsc className="h-5 w-5 mr-1" />
          Sort
        </Button>

        {selectedUserId !== null && (
          <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
            <span>
              Filtered by: {teamMembers.find(m => m.id === selectedUserId)?.displayName}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 rounded-full hover:bg-slate-200" 
              onClick={clearFilter}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-sm text-slate-500">Team members:</span>
        <div className="flex -space-x-2">
          <TooltipProvider>
            {teamMembers.slice(0, 4).map((member) => (
              <Tooltip key={member.id}>
                <TooltipTrigger asChild>
                  <img 
                    src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.displayName)}`}
                    alt={member.displayName} 
                    className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-all ${
                      selectedUserId === member.id 
                        ? 'border-primary scale-110 z-10' 
                        : 'border-white hover:border-slate-300'
                    }`}
                    onClick={() => handleUserClick(member.id)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filter tasks for {member.displayName}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
          
          {teamMembers.length > 4 && (
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-xs font-medium border-2 border-white flex items-center justify-center">
              +{teamMembers.length - 4}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
