import { FC, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Task, User, TaskStatus } from '@shared/schema';

import Sidebar from '@/components/Sidebar';
import TopNavigation from '@/components/TopNavigation';
import Toolbar from '@/components/Toolbar';
import ListView from '@/components/ListView';
import KanbanView from '@/components/KanbanView';
import GanttView from '@/components/GanttView';
import TaskDetailModal from '@/components/TaskDetailModal';
import NewTaskModal from '@/components/NewTaskModal';

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

  // Workspace ID (hardcoded to 1 for demo)
  const workspaceId = 1;

  // Fetch users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch workspace
  const { data: workspace } = useQuery({
    queryKey: ['/api/workspaces', workspaceId],
  });

  // Fetch tasks
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/workspaces', workspaceId, 'tasks'],
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
      const status = completed ? TaskStatus.COMPLETED : TaskStatus.TODO;
      return apiRequest('PATCH', `/api/tasks/${taskId}`, { 
        completed,
        status: completed ? TaskStatus.COMPLETED : task?.status
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
          <Toolbar 
            onNewTask={handleNewTask} 
            teamMembers={users}
          />
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* List View */}
            {currentView === 'list' && (
              <ListView 
                tasks={tasks}
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
                tasks={tasks}
                users={users}
                onTaskClick={handleTaskClick}
                onStatusChange={handleTaskStatusChange}
                onAddTask={handleAddTaskInColumn}
              />
            )}

            {/* Gantt View */}
            {currentView === 'gantt' && (
              <GanttView 
                tasks={tasks}
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
