import { FC, useState } from 'react';
import { Plus, Filter, SortAsc, X, Check, ArrowUpDown, ArrowUp, ArrowDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { User } from '@shared/schema';

export type SortOption = 'due-asc' | 'due-desc' | 'priority-asc' | 'priority-desc' | 'title-asc' | 'title-desc' | null;

export type FilterOption = 'all' | 'completed' | 'active' | null;

interface ToolbarProps {
  onNewTask: () => void;
  onNewEpic?: () => void;
  teamMembers: User[];
  onFilterByUser?: (userId: number | null) => void;
  onSort?: (sortOption: SortOption) => void;
  onFilter?: (filterOption: FilterOption) => void;
}

const Toolbar: FC<ToolbarProps> = ({ 
  onNewTask, 
  onNewEpic,
  teamMembers, 
  onFilterByUser,
  onSort,
  onFilter 
}) => {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [currentSort, setCurrentSort] = useState<SortOption>(null);
  const [currentFilter, setCurrentFilter] = useState<FilterOption>(null);

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

  const handleSort = (option: SortOption) => {
    setCurrentSort(option);
    if (onSort) {
      onSort(option);
    }
  };

  const handleFilter = (option: FilterOption) => {
    setCurrentFilter(option);
    if (onFilter) {
      onFilter(option);
    }
  };

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case 'due-asc': return 'Due Date (Earliest First)';
      case 'due-desc': return 'Due Date (Latest First)';
      case 'priority-asc': return 'Priority (Low to High)';
      case 'priority-desc': return 'Priority (High to Low)';
      case 'title-asc': return 'Title (A-Z)';
      case 'title-desc': return 'Title (Z-A)';
      default: return null;
    }
  };

  const getFilterLabel = (option: FilterOption) => {
    switch (option) {
      case 'all': return 'All Tasks';
      case 'completed': return 'Completed Tasks';
      case 'active': return 'Active Tasks';
      default: return null;
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
        
        {onNewEpic && (
          <Button 
            onClick={onNewEpic}
            variant="secondary"
            className="inline-flex items-center justify-center"
          >
            <Layers className="h-5 w-5 mr-1" />
            New Epic
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="inline-flex items-center justify-center">
              <Filter className="h-5 w-5 mr-1" />
              Filter
              {currentFilter && <Badge className="ml-2 font-normal" variant="secondary">1</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter Tasks</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleFilter('all')}
              className="flex justify-between"
            >
              <span>All Tasks</span>
              {currentFilter === 'all' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleFilter('active')}
              className="flex justify-between"
            >
              <span>Active Tasks</span>
              {currentFilter === 'active' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleFilter('completed')}
              className="flex justify-between"
            >
              <span>Completed Tasks</span>
              {currentFilter === 'completed' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            {currentFilter && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleFilter(null)}>
                  <span className="text-red-500">Clear Filter</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="inline-flex items-center justify-center">
              <SortAsc className="h-5 w-5 mr-1" />
              Sort
              {currentSort && <Badge className="ml-2 font-normal" variant="secondary">1</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Sort Tasks</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">By Due Date</DropdownMenuLabel>
            <DropdownMenuItem 
              onClick={() => handleSort('due-asc')}
              className="flex justify-between"
            >
              <div className="flex items-center">
                <ArrowUp className="h-4 w-4 mr-2" />
                <span>Earliest First</span>
              </div>
              {currentSort === 'due-asc' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleSort('due-desc')}
              className="flex justify-between"
            >
              <div className="flex items-center">
                <ArrowDown className="h-4 w-4 mr-2" />
                <span>Latest First</span>
              </div>
              {currentSort === 'due-desc' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">By Priority</DropdownMenuLabel>
            <DropdownMenuItem 
              onClick={() => handleSort('priority-asc')}
              className="flex justify-between"
            >
              <div className="flex items-center">
                <ArrowUp className="h-4 w-4 mr-2" />
                <span>Low to High</span>
              </div>
              {currentSort === 'priority-asc' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleSort('priority-desc')}
              className="flex justify-between"
            >
              <div className="flex items-center">
                <ArrowDown className="h-4 w-4 mr-2" />
                <span>High to Low</span>
              </div>
              {currentSort === 'priority-desc' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">By Title</DropdownMenuLabel>
            <DropdownMenuItem 
              onClick={() => handleSort('title-asc')}
              className="flex justify-between"
            >
              <div className="flex items-center">
                <ArrowUp className="h-4 w-4 mr-2" />
                <span>A-Z</span>
              </div>
              {currentSort === 'title-asc' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleSort('title-desc')}
              className="flex justify-between"
            >
              <div className="flex items-center">
                <ArrowDown className="h-4 w-4 mr-2" />
                <span>Z-A</span>
              </div>
              {currentSort === 'title-desc' && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            
            {currentSort && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleSort(null)}>
                  <span className="text-red-500">Clear Sorting</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {currentSort && (
          <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
            <span>
              Sorted by: {getSortLabel(currentSort)}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 rounded-full hover:bg-slate-200" 
              onClick={() => handleSort(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {currentFilter && (
          <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
            <span>
              Filter: {getFilterLabel(currentFilter)}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 rounded-full hover:bg-slate-200" 
              onClick={() => handleFilter(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}

        {selectedUserId !== null && (
          <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
            <span>
              Assigned to: {teamMembers.find(m => m.id === selectedUserId)?.displayName}
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
