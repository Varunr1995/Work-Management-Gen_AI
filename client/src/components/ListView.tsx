import { FC } from 'react';
import { Task, User } from '@shared/schema';
import { Edit, Trash, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface ListViewProps {
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: number) => void;
  onTaskComplete: (taskId: number, completed: boolean) => void;
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

const ListView: FC<ListViewProps> = ({ 
  tasks, 
  users, 
  onTaskClick, 
  onTaskEdit, 
  onTaskDelete, 
  onTaskComplete 
}) => {
  const getAssignee = (assigneeId: number | null) => {
    if (!assigneeId) return null;
    return users.find(user => user.id === assigneeId);
  };

  return (
    <div className="block">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <div className="flex items-center">
                  <Checkbox className="h-4 w-4 text-primary rounded border-slate-300" />
                  <span className="ml-3">Task</span>
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Priority</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assignee</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Due Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {tasks.map((task) => {
              const assignee = getAssignee(task.assigneeId || null);
              return (
                <tr 
                  key={task.id} 
                  className="hover:bg-slate-50 cursor-pointer" 
                  onClick={() => onTaskClick(task)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Checkbox 
                        className="h-4 w-4 text-primary rounded border-slate-300"
                        checked={task.completed}
                        onCheckedChange={(checked) => {
                          onTaskComplete(task.id, checked as boolean);
                          // Stop event propagation to prevent the row click event
                          event?.stopPropagation();
                        }}
                      />
                      <div className="ml-3">
                        <div className={`text-sm font-medium text-slate-900 ${task.completed ? 'line-through' : ''}`}>
                          {task.title}
                        </div>
                        <div className={`text-sm text-slate-500 ${task.completed ? 'line-through' : ''}`}>
                          {task.description && task.description.length > 50 
                            ? `${task.description.substring(0, 50)}...` 
                            : task.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeVariant(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityBadgeVariant(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {assignee ? (
                      <div className="flex items-center">
                        <img 
                          className="h-8 w-8 rounded-full" 
                          src={assignee.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee.displayName)}`} 
                          alt={assignee.displayName} 
                        />
                        <div className="ml-2">
                          <div className="text-sm font-medium text-slate-900">{assignee.displayName}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      className="text-slate-400 hover:text-slate-500 mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskEdit(task);
                      }}
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button 
                      className="text-slate-400 hover:text-slate-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskDelete(task.id);
                      }}
                    >
                      <Trash className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-slate-500">
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ListView;
