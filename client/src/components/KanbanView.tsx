import { FC, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Task, User, TaskStatus } from '@shared/schema';
import { Plus, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface KanbanViewProps {
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: number, newStatus: string) => void;
  onAddTask: (status: string) => void;
}

const getColumnTitle = (status: string) => {
  switch (status) {
    case TaskStatus.TODO:
      return { name: 'To Do', color: 'bg-blue-500' };
    case TaskStatus.IN_PROGRESS:
      return { name: 'In Progress', color: 'bg-yellow-500' };
    case TaskStatus.IN_REVIEW:
      return { name: 'In Review', color: 'bg-purple-500' };
    case TaskStatus.COMPLETED:
      return { name: 'Completed', color: 'bg-green-500' };
    default:
      return { name: status, color: 'bg-gray-500' };
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

const KanbanView: FC<KanbanViewProps> = ({ 
  tasks, 
  users, 
  onTaskClick, 
  onStatusChange, 
  onAddTask 
}) => {
  const tasksByStatus = {
    [TaskStatus.TODO]: Array.isArray(tasks) ? tasks.filter(task => task.status === TaskStatus.TODO) : [],
    [TaskStatus.IN_PROGRESS]: Array.isArray(tasks) ? tasks.filter(task => task.status === TaskStatus.IN_PROGRESS) : [],
    [TaskStatus.IN_REVIEW]: Array.isArray(tasks) ? tasks.filter(task => task.status === TaskStatus.IN_REVIEW) : [],
    [TaskStatus.COMPLETED]: Array.isArray(tasks) ? tasks.filter(task => task.status === TaskStatus.COMPLETED) : [],
  };

  const statuses = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.IN_REVIEW,
    TaskStatus.COMPLETED
  ];

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // Dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    // Handle reordering within the same column or moving to a different column
    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId;
    
    // Call API to update task status
    onStatusChange(taskId, newStatus);
  };

  const getAssignee = (assigneeId: number | null) => {
    if (!assigneeId) return null;
    return Array.isArray(users) ? users.find(user => user.id === assigneeId) : null;
  };

  return (
    <div className="p-6">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {statuses.map(status => {
            const columnTasks = tasksByStatus[status] || [];
            const columnInfo = getColumnTitle(status);
            
            return (
              <div key={status} className="flex-shrink-0 w-80">
                <div className="bg-slate-100 rounded-lg shadow-sm">
                  <div className="p-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-700 flex items-center">
                        <span className={`w-2.5 h-2.5 rounded-full ${columnInfo.color} mr-2`}></span>
                        {columnInfo.name}
                        <span className="ml-2 text-xs text-slate-500 font-normal">{columnTasks.length}</span>
                      </h3>
                      <button className="text-slate-400 hover:text-slate-500">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  <Droppable droppableId={status}>
                    {(provided) => (
                      <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps}
                        className="p-3 kanban-column min-h-[400px]"
                      >
                        {columnTasks.map((task, index) => {
                          const assignee = getAssignee(task.assigneeId || null);
                          return (
                            <Draggable 
                              key={`task-${task.id}`} 
                              draggableId={task.id.toString()} 
                              index={index}
                            >
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-white p-3 rounded-lg shadow-sm mb-3 task-card border border-slate-200 hover:shadow-md transition-all ${
                                    task.completed ? 'opacity-60' : ''
                                  }`}
                                  onClick={() => onTaskClick(task)}
                                >
                                  <div className="flex justify-between items-start">
                                    <span className={`px-2 py-1 text-xs rounded-full ${getPriorityBadgeVariant(task.priority)} font-medium`}>
                                      {getPriorityLabel(task.priority)}
                                    </span>
                                    <button 
                                      className="text-slate-400 hover:text-slate-500"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Handle more button click
                                      }}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  </div>
                                  
                                  <h4 className={`text-sm font-medium text-slate-800 mt-2 ${task.completed ? 'line-through' : ''}`}>
                                    {task.title}
                                  </h4>
                                  <p className={`text-xs text-slate-500 mt-1 ${task.completed ? 'line-through' : ''}`}>
                                    {task.description && task.description.length > 60 
                                      ? `${task.description.substring(0, 60)}...` 
                                      : task.description}
                                  </p>
                                  
                                  <div className="mt-3 flex justify-between items-center">
                                    <div className="flex items-center">
                                      {assignee && (
                                        <img 
                                          src={assignee.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee.displayName)}`} 
                                          alt={assignee.displayName} 
                                          className="w-6 h-6 rounded-full" 
                                        />
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {task.dueDate ? format(new Date(task.dueDate), 'MMM dd') : ''}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        <button 
                          className="w-full py-2 flex items-center justify-center text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-md"
                          onClick={() => onAddTask(status)}
                        >
                          <Plus className="h-5 w-5 mr-1" />
                          Add task
                        </button>
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            );
          })}

          {/* Add Column Button */}
          <div className="flex-shrink-0 w-80 flex items-start">
            <button className="w-full py-3 flex items-center justify-center text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg border-2 border-dashed border-slate-300 h-16">
              <Plus className="h-5 w-5 mr-1" />
              Add column
            </button>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

export default KanbanView;
