import { FC } from 'react';
import { Plus, Filter, SortAsc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { User } from '@shared/schema';

interface ToolbarProps {
  onNewTask: () => void;
  teamMembers: User[];
}

const Toolbar: FC<ToolbarProps> = ({ onNewTask, teamMembers }) => {
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
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-sm text-slate-500">Team members:</span>
        <div className="flex -space-x-2">
          {teamMembers.slice(0, 4).map((member, index) => (
            <img 
              key={member.id}
              src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.displayName)}`}
              alt={member.displayName} 
              className="w-8 h-8 rounded-full border-2 border-white"
            />
          ))}
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
