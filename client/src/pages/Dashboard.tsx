import { FC, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Task, User, TaskStatus } from '@shared/schema';

import Sidebar from '@/components/Sidebar';
import TopNavigation from '@/components/TopNavigation';
import Toolbar, { SortOption, FilterOption } from '@/components/Toolbar';
import ListView from '@/components/ListView';
import KanbanView from '@/components/KanbanView';
import GanttView from '@/components/GanttView';
import TaskDetailModal from '@/components/TaskDetailModal';
import NewTaskModal from '@/components/NewTaskModal';
import { EmailIntegration } from '@/components/EmailIntegration';

const Dashboard: FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [currentView, setCurrentView] = useState('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | undefined>();
  const [filterByUserId, setFilterByUserId] = useState<number | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>(null);
  const [filterOption, setFilterOption] = useState<FilterOption>(null);

  // Workspace ID (hardcoded to 1 for demo)
  const workspaceId = 1;

  // Fetch users
  const { data: users = [], isLoading: isUsersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      try {
        console.log('Fetching users');
        const response = await apiRequest('GET', '/api/users');
        console.log('Users response:', response);
        if (!response) return [];
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error('Error fetching users:', error);
        return [];
      }
    },
    refetchOnMount: true
  });

  // Fetch workspace
  const { data: workspace = { name: 'Workspace' } } = useQuery<{ name: string }>({
    queryKey: ['/api/workspaces', workspaceId],
    queryFn: async () => {
      try {
        console.log('Fetching workspace:', workspaceId);
        const response = await apiRequest('GET', `/api/workspaces/${workspaceId}`);
        console.log('Workspace response:', response);
        if (!response) return { name: 'Workspace' };
        return response;
      } catch (error) {
        console.error('Error fetching workspace:', error);
        return { name: 'Workspace' };
      }
    },
    refetchOnMount: true
  });

  // Fetch tasks
  const { data: tasks = [], isLoading: isTasksLoading, refetch: refetchTasks } = useQuery<Task[]>({
    queryKey: ['/api/workspaces', workspaceId, 'tasks'],
    queryFn: async () => {
      try {
        console.log('Fetching tasks for workspace:', workspaceId);
        const response = await apiRequest('GET', `/api/workspaces/${workspaceId}/tasks`);
        console.log('Raw tasks response:', response);
        
        // Make sure we're returning an array
        if (!response) return [];
        const taskArray = Array.isArray(response) ? response : [];
        
        // Log the returned tasks
        console.log('Number of tasks loaded:', taskArray.length);
        if (taskArray.length > 0) {
          console.log('First task:', taskArray[0]);
        }
        
        return taskArray;
      } catch (error) {
        console.error('Error fetching tasks:', error);
        return [];
      }
    },
    // Ensure task data is always fresh
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    refetchOnMount: true,
    // In React Query v5, cacheTime is renamed to gcTime
    gcTime: 0
  });

  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus }: { taskId: number; newStatus: string }) => {
      return apiRequest('PATCH', `/api/tasks/${taskId}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'tasks'] });
      toast({
        title: "Task updated",
        description: "Task status has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  });

  // Toggle task completion mutation
  const toggleTaskCompletionMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: number; completed: boolean }) => {
      const task = tasks.find(t => t.id === taskId);
      const status = completed ? TaskStatus.COMPLETED : TaskStatus.TODO;
      return apiRequest('PATCH', `/api/tasks/${taskId}`, { 
        completed,
        status: completed ? TaskStatus.COMPLETED : (task?.status || TaskStatus.TODO)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'tasks'] });
      toast({
        title: "Task updated",
        description: "Task completion status has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task completion status",
        variant: "destructive",
      });
    }
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest('DELETE', `/api/tasks/${taskId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'tasks'] });
      toast({
        title: "Task deleted",
        description: "Task has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  });

  // Handlers
  const handleViewChange = (view: string) => {
    setCurrentView(view);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDetailOpen(true);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setNewTaskStatus(undefined);
    setIsNewTaskOpen(true);
  };

  const handleTaskEdit = (task: Task) => {
    setEditingTask(task);
    setIsNewTaskOpen(true);
    setIsTaskDetailOpen(false);
  };

  const handleTaskDelete = (taskId: number) => {
    deleteTaskMutation.mutate(taskId);
  };

  const handleTaskStatusChange = (taskId: number, newStatus: string) => {
    updateTaskStatusMutation.mutate({ taskId, newStatus });
  };

  const handleTaskComplete = (taskId: number, completed: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      toggleTaskCompletionMutation.mutate({ taskId, completed });
    }
  };

  const handleAddTaskInColumn = (status: string) => {
    setNewTaskStatus(status);
    setEditingTask(null);
    setIsNewTaskOpen(true);
  };

  // Filter and sort tasks based on current options
  const filteredTasks = useMemo(() => {
    // Make sure tasks is an array before processing
    if (!Array.isArray(tasks)) {
      console.log('Tasks is not an array:', tasks);
      return [];
    }
    
    // Start with all tasks
    let result = [...tasks];
    
    // Filter by user ID if needed
    if (filterByUserId !== null) {
      result = result.filter(task => task.assigneeId === filterByUserId);
    }
    
    // Apply task status filter
    if (filterOption) {
      switch (filterOption) {
        case 'completed':
          result = result.filter(task => task.completed === true);
          break;
        case 'active':
          result = result.filter(task => task.completed !== true);
          break;
        // 'all' shows everything, no filter needed
      }
    }
    
    // Apply sorting
    if (sortOption) {
      switch (sortOption) {
        case 'due-asc':
          result.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          });
          break;
        case 'due-desc':
          result.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
          });
          break;
        case 'priority-asc': // Low to high
          result.sort((a, b) => {
            const priorityOrder = { low: 0, medium: 1, high: 2 };
            return priorityOrder[a.priority as keyof typeof priorityOrder] - 
                   priorityOrder[b.priority as keyof typeof priorityOrder];
          });
          break;
        case 'priority-desc': // High to low
          result.sort((a, b) => {
            const priorityOrder = { low: 0, medium: 1, high: 2 };
            return priorityOrder[b.priority as keyof typeof priorityOrder] - 
                   priorityOrder[a.priority as keyof typeof priorityOrder];
          });
          break;
        case 'title-asc':
          result.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'title-desc':
          result.sort((a, b) => b.title.localeCompare(a.title));
          break;
      }
    }
    
    return result;
  }, [tasks, filterByUserId, filterOption, sortOption]);
  
  // Handlers for filtering and sorting
  const handleFilterByUser = (userId: number | null) => {
    setFilterByUserId(userId);
    console.log('Filtering tasks for user ID:', userId);
  };
  
  const handleSort = (option: SortOption) => {
    setSortOption(option);
    console.log('Sorting tasks by:', option);
  };
  
  const handleFilter = (option: FilterOption) => {
    setFilterOption(option);
    console.log('Filtering tasks by status:', option);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavigation 
          workspaceName={workspace?.name || 'Workspace'} 
          onViewChange={handleViewChange}
          currentView={currentView}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Toolbar 
                onNewTask={handleNewTask} 
                teamMembers={users}
                onFilterByUser={handleFilterByUser}
                onSort={handleSort}
                onFilter={handleFilter}
              />
            </div>
            <div className="md:w-96">
              <EmailIntegration />
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* List View */}
            {currentView === 'list' && (
              <ListView 
                tasks={filteredTasks}
                users={users}
                onTaskClick={handleTaskClick}
                onTaskEdit={handleTaskEdit}
                onTaskDelete={handleTaskDelete}
                onTaskComplete={handleTaskComplete}
              />
            )}

            {/* Kanban View */}
            {currentView === 'kanban' && (
              <KanbanView 
                tasks={filteredTasks}
                users={users}
                onTaskClick={handleTaskClick}
                onStatusChange={handleTaskStatusChange}
                onAddTask={handleAddTaskInColumn}
              />
            )}

            {/* Gantt View */}
            {currentView === 'gantt' && (
              <GanttView 
                tasks={filteredTasks}
                users={users}
                onTaskClick={handleTaskClick}
              />
            )}
          </div>
        </main>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isTaskDetailOpen}
        onClose={() => setIsTaskDetailOpen(false)}
        onEdit={handleTaskEdit}
        onDelete={handleTaskDelete}
        users={users}
      />

      {/* New/Edit Task Modal */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        users={users}
        workspaceId={workspaceId}
        editTask={editingTask}
        defaultStatus={newTaskStatus}
      />
    </div>
  );
};

export default Dashboard;
