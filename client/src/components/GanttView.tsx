import { FC, useMemo } from 'react';
import { Task, User } from '@shared/schema';
import { format, addDays, eachDayOfInterval, isSameDay, differenceInDays, startOfDay } from 'date-fns';

interface GanttViewProps {
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
}

const GanttView: FC<GanttViewProps> = ({ tasks, users, onTaskClick }) => {
  // Calculate date range for the Gantt chart
  const dateRange = useMemo(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      const today = new Date();
      return {
        start: today,
        end: addDays(today, 13),
        days: eachDayOfInterval({
          start: today,
          end: addDays(today, 13)
        })
      };
    }

    let minDate = new Date();
    let maxDate = new Date();

    tasks.forEach(task => {
      if (task.startDate) {
        const startDate = new Date(task.startDate);
        if (startDate < minDate) {
          minDate = startDate;
        }
      }
      
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        if (dueDate > maxDate) {
          maxDate = dueDate;
        }
      }
    });

    // Ensure we show at least 14 days
    const daysDiff = differenceInDays(maxDate, minDate);
    if (daysDiff < 13) {
      maxDate = addDays(minDate, 13);
    }

    return {
      start: minDate,
      end: maxDate,
      days: eachDayOfInterval({
        start: minDate,
        end: maxDate
      })
    };
  }, [tasks]);

  // Calculate the position and width of each task bar in the Gantt chart
  const calculateTaskPosition = (task: Task) => {
    const startDate = task.startDate ? new Date(task.startDate) : dateRange.start;
    const dueDate = task.dueDate ? new Date(task.dueDate) : addDays(startDate, 1);
    
    const startOffset = differenceInDays(startOfDay(startDate), startOfDay(dateRange.start));
    const duration = differenceInDays(startOfDay(dueDate), startOfDay(startDate)) + 1;
    
    const totalDays = dateRange.days.length;
    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    
    return { left: `${left}%`, width: `${width}%` };
  };

  // Determine color based on priority
  const getTaskColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
        return 'bg-emerald-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="p-6">
        {/* Gantt Header */}
        <div className="flex mb-4 items-center">
          <div className="w-1/4 pr-4">
            <h3 className="text-sm font-medium text-slate-600">Task</h3>
          </div>
          <div className="w-3/4 flex">
            {/* Timeline days */}
            {dateRange.days.map(day => (
              <div 
                key={format(day, 'yyyy-MM-dd')} 
                className="flex-1 text-center text-xs font-medium text-slate-500"
              >
                {format(day, 'MMM dd')}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200"></div>
        
        {/* Gantt Rows */}
        {Array.isArray(tasks) && tasks.map(task => {
          const position = calculateTaskPosition(task);
          const taskColor = getTaskColor(task.priority);
          
          return (
            <div 
              key={task.id} 
              className="flex gantt-row items-center border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
              onClick={() => onTaskClick(task)}
            >
              <div className="w-1/4 pr-4 py-2 flex items-center">
                <span className={`w-2 h-2 rounded-full mr-2 ${taskColor.replace('500', '600')}`}></span>
                <span className="text-sm font-medium text-slate-700 truncate">
                  {task.title}
                </span>
              </div>
              <div className="w-3/4 relative h-10">
                <div 
                  className={`gantt-task ${taskColor} opacity-80 absolute`} 
                  style={{ left: position.left, width: position.width }}
                >
                  <div className="h-full flex items-center justify-center text-xs text-white font-medium">
                    {parseFloat(position.width) > 10 ? task.title : ''}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {(!Array.isArray(tasks) || tasks.length === 0) && (
          <div className="py-4 text-center text-sm text-slate-500">
            No tasks found
          </div>
        )}
      </div>
    </div>
  );
};

export default GanttView;
