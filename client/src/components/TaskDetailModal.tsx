import { FC, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, User, Comment, Subtask } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: number) => void;
  users: User[];
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'todo':
      return 'bg-blue-100 text-blue-800';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800';
    case 'in_review':
      return 'bg-purple-100 text-purple-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityBadgeVariant = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'todo':
      return 'To do';
    case 'in_progress':
      return 'In progress';
    case 'in_review':
      return 'In review';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return priority;
  }
};

const TaskDetailModal: FC<TaskDetailModalProps> = ({ 
  task, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete, 
  users 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  const assignee = task?.assigneeId 
    ? users.find(user => user.id === task.assigneeId) 
    : null;

  // Fetch subtasks
  const { data: subtasks = [] } = useQuery({
    queryKey: ['/api/tasks', task?.id, 'subtasks'],
    queryFn: async () => {
      if (!task) return [];
      const res = await fetch(`/api/tasks/${task.id}/subtasks`);
      if (!res.ok) throw new Error('Failed to fetch subtasks');
      return res.json();
    },
    enabled: !!task,
  });

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ['/api/tasks', task?.id, 'comments'],
    queryFn: async () => {
      if (!task) return [];
      const res = await fetch(`/api/tasks/${task.id}/comments`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    enabled: !!task,
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!task) throw new Error('No task selected');
      return apiRequest('POST', '/api/comments', {
        taskId: task.id,
        userId: 1, // Default to first user for demo
        content
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', task?.id, 'comments'] });
      setNewComment('');
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    }
  });

  // Add subtask mutation
  const addSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!task) throw new Error('No task selected');
      return apiRequest('POST', '/api/subtasks', {
        taskId: task.id,
        title,
        completed: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', task?.id, 'subtasks'] });
      setNewSubtask('');
      toast({
        title: "Subtask added",
        description: "Subtask has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add subtask",
        variant: "destructive",
      });
    }
  });

  // Toggle subtask completion
  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number, completed: boolean }) => {
      return apiRequest('PATCH', `/api/subtasks/${id}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', task?.id, 'subtasks'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update subtask",
        variant: "destructive",
      });
    }
  });

  // Handle comment submission
  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  // Handle subtask addition
  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    addSubtaskMutation.mutate(newSubtask);
  };

  // Handle subtask toggle
  const handleToggleSubtask = (subtask: Subtask) => {
    toggleSubtaskMutation.mutate({ 
      id: subtask.id, 
      completed: !subtask.completed 
    });
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setNewComment('');
      setNewSubtask('');
    }
  }, [isOpen]);

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 text-xs rounded-full ${getPriorityBadgeVariant(task.priority)} font-medium mr-2`}>
              {getPriorityLabel(task.priority)}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeVariant(task.status)} font-medium`}>
              {getStatusLabel(task.status)}
            </span>
          </div>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {task.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1 py-4">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-500 mb-2">Description</h3>
            <div className="bg-slate-50 rounded-md p-4">
              <p className="text-slate-700">
                {task.description || 'No description provided'}
              </p>
            </div>
          </div>
          
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Assignee</h3>
              {assignee ? (
                <div className="flex items-center">
                  <img 
                    className="h-8 w-8 rounded-full mr-2" 
                    src={assignee.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee.displayName)}`} 
                    alt={assignee.displayName} 
                  />
                  <span className="text-sm text-slate-700">{assignee.displayName}</span>
                </div>
              ) : (
                <span className="text-sm text-slate-500">Unassigned</span>
              )}
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Due Date</h3>
              <div className="text-sm text-slate-700">
                {task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : 'No due date'}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Start Date</h3>
              <div className="text-sm text-slate-700">
                {task.startDate ? format(new Date(task.startDate), 'MMM dd, yyyy') : 'Not set'}
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-500 mb-2">Subtasks</h3>
            {subtasks.length > 0 ? (
              <div className="space-y-2">
                {subtasks.map((subtask: Subtask) => (
                  <div key={subtask.id} className="flex items-center">
                    <Checkbox 
                      checked={subtask.completed}
                      onCheckedChange={() => handleToggleSubtask(subtask)}
                      className="h-4 w-4 text-primary rounded border-slate-300" 
                    />
                    <span className={`ml-2 text-sm ${subtask.completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                      {subtask.title}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No subtasks</p>
            )}
            
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add a subtask"
                className="flex-1 text-sm rounded-md border-slate-300"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim() || addSubtaskMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Comments</h3>
            {comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment: Comment & { user?: User }) => {
                  const commentUser = users.find(user => user.id === comment.userId);
                  return (
                    <div key={comment.id} className="flex">
                      <img 
                        className="h-8 w-8 rounded-full mr-3" 
                        src={commentUser?.avatarUrl || `https://ui-avatars.com/api/?name=User`} 
                        alt={commentUser?.displayName || 'User'} 
                      />
                      <div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center mb-1">
                            <span className="font-medium text-sm text-slate-700 mr-2">
                              {commentUser?.displayName || 'User'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {format(new Date(comment.createdAt), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-4">No comments yet</p>
            )}
            
            <div className="mt-4">
              <div className="flex">
                <img 
                  className="h-8 w-8 rounded-full mr-3" 
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
                  alt="Current user" 
                />
                <div className="flex-1">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="block w-full text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button 
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      size="sm"
                    >
                      Comment
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="border-t border-slate-200 pt-4">
          <div className="flex justify-between w-full">
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                className="inline-flex items-center"
                onClick={() => onEdit(task)}
              >
                <Edit className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                className="inline-flex items-center"
              >
                <Calendar className="h-4 w-4 mr-1.5" />
                Change due date
              </Button>
            </div>
            <Button 
              variant="destructive" 
              className="inline-flex items-center"
              onClick={() => {
                onDelete(task.id);
                onClose();
              }}
            >
              <Trash className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailModal;
