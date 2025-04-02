import { 
  users, User, InsertUser,
  workspaces, Workspace, InsertWorkspace,
  tasks, Task, InsertTask, TaskStatus, TaskPriority, TaskType,
  subtasks, Subtask, InsertSubtask,
  comments, Comment, InsertComment,
  notifications, Notification, InsertNotification
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  // Workspace operations
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getWorkspaces(): Promise<Workspace[]>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: number, workspace: Partial<InsertWorkspace>): Promise<Workspace | undefined>;
  deleteWorkspace(id: number): Promise<boolean>;

  // Task operations
  getTask(id: number): Promise<Task | undefined>;
  getTasks(workspaceId: number): Promise<Task[]>;
  getTasksByStatus(workspaceId: number, status: string): Promise<Task[]>;
  getTasksByType(workspaceId: number, taskType: string): Promise<Task[]>;
  getTasksByEpicId(epicId: number): Promise<Task[]>;
  getRelatedTasks(parentTaskId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  updateTaskStatus(id: number, status: string): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;

  // Subtask operations
  getSubtasks(taskId: number): Promise<Subtask[]>;
  createSubtask(subtask: InsertSubtask): Promise<Subtask>;
  updateSubtask(id: number, completed: boolean): Promise<Subtask | undefined>;
  deleteSubtask(id: number): Promise<boolean>;

  // Comment operations
  getComments(taskId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: number): Promise<boolean>;
  
  // Notification operations
  getNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  deleteNotification(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private workspaces: Map<number, Workspace>;
  private tasks: Map<number, Task>;
  private subtasks: Map<number, Subtask>;
  private comments: Map<number, Comment>;
  private notifications: Map<number, Notification>;
  
  private userId: number;
  private workspaceId: number;
  private taskId: number;
  private subtaskId: number;
  private commentId: number;
  private notificationId: number;

  constructor() {
    this.users = new Map();
    this.workspaces = new Map();
    this.tasks = new Map();
    this.subtasks = new Map();
    this.comments = new Map();
    this.notifications = new Map();
    
    this.userId = 1;
    this.workspaceId = 1;
    this.taskId = 1;
    this.subtaskId = 1;
    this.commentId = 1;
    this.notificationId = 1;
    
    this.initSampleData();
  }

  private initSampleData() {
    // Create sample users
    const users = [
      { id: this.userId++, username: 'alex', password: 'password', displayName: 'Alex Morgan', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', role: 'admin' },
      { id: this.userId++, username: 'sarah', password: 'password', displayName: 'Sarah Chen', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', role: 'user' },
      { id: this.userId++, username: 'marcus', password: 'password', displayName: 'Marcus Kim', avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', role: 'user' },
      { id: this.userId++, username: 'jessica', password: 'password', displayName: 'Jessica Lee', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80', role: 'user' }
    ];

    for (const user of users) {
      this.users.set(user.id, user as User);
    }

    // Create a sample workspace
    const workspace = {
      id: this.workspaceId++,
      name: 'Main Project',
      description: 'Primary project workspace'
    };
    
    this.workspaces.set(workspace.id, workspace as Workspace);

    // Create sample tasks
    const sampleTasks = [
      {
        id: this.taskId++,
        title: 'Website redesign',
        description: 'Update the homepage layout with the new design system. Focus on improving the hero section and navigation. Implement responsive design for all screen sizes.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assigneeId: 2,
        workspaceId: workspace.id,
        dueDate: new Date('2023-09-23'),
        startDate: new Date('2023-09-15'),
        completed: false,
        position: 1
      },
      {
        id: this.taskId++,
        title: 'Create user onboarding flow',
        description: 'Design new user tutorial and onboarding experience for first-time users.',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        assigneeId: 1,
        workspaceId: workspace.id,
        dueDate: new Date('2023-10-05'),
        startDate: new Date('2023-09-25'),
        completed: false,
        position: 1
      },
      {
        id: this.taskId++,
        title: 'API documentation',
        description: 'Write API endpoints documentation for developers.',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.LOW,
        assigneeId: 3,
        workspaceId: workspace.id,
        dueDate: new Date('2023-09-18'),
        startDate: new Date('2023-09-10'),
        completed: true,
        position: 1
      },
      {
        id: this.taskId++,
        title: 'Performance optimization',
        description: 'Improve loading times and application performance.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assigneeId: 4,
        workspaceId: workspace.id,
        dueDate: new Date('2023-09-30'),
        startDate: new Date('2023-09-20'),
        completed: false,
        position: 2
      },
      {
        id: this.taskId++,
        title: 'Customer feedback survey',
        description: 'Create end-user feedback form to gather insights.',
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        assigneeId: 2,
        workspaceId: workspace.id,
        dueDate: new Date('2023-10-12'),
        startDate: new Date('2023-10-01'),
        completed: false,
        position: 2
      },
      {
        id: this.taskId++,
        title: 'Mobile app navigation',
        description: 'Review updated navigation flow for the mobile application.',
        status: TaskStatus.IN_REVIEW,
        priority: TaskPriority.MEDIUM,
        assigneeId: 3,
        workspaceId: workspace.id,
        dueDate: new Date('2023-10-02'),
        startDate: new Date('2023-09-25'),
        completed: false,
        position: 1
      }
    ];

    for (const task of sampleTasks) {
      this.tasks.set(task.id, task as Task);
    }

    // Add sample subtasks
    const sampleSubtasks = [
      { id: this.subtaskId++, taskId: 1, title: 'Create wireframes', completed: true },
      { id: this.subtaskId++, taskId: 1, title: 'Implement new navigation', completed: false },
      { id: this.subtaskId++, taskId: 1, title: 'Update hero section', completed: false },
      { id: this.subtaskId++, taskId: 1, title: 'Test responsive design', completed: false },
      { id: this.subtaskId++, taskId: 3, title: 'Document authentication endpoints', completed: true },
      { id: this.subtaskId++, taskId: 3, title: 'Create API examples', completed: true }
    ];

    for (const subtask of sampleSubtasks) {
      this.subtasks.set(subtask.id, subtask as Subtask);
    }

    // Add sample comments
    const sampleComments = [
      { 
        id: this.commentId++, 
        taskId: 1, 
        userId: 3, 
        content: 'I\'ve reviewed the wireframes. Looking good, but we might need to adjust the mobile navigation to improve accessibility.', 
        createdAt: new Date('2023-09-17T12:00:00Z') 
      },
      { 
        id: this.commentId++, 
        taskId: 1, 
        userId: 2, 
        content: 'I\'ll make those adjustments today. We should be on track to complete this by the due date.', 
        createdAt: new Date('2023-09-18T09:30:00Z') 
      }
    ];

    for (const comment of sampleComments) {
      this.comments.set(comment.id, comment as Comment);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Workspace operations
  async getWorkspace(id: number): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return Array.from(this.workspaces.values());
  }

  async createWorkspace(insertWorkspace: InsertWorkspace): Promise<Workspace> {
    const id = this.workspaceId++;
    const workspace: Workspace = { ...insertWorkspace, id };
    this.workspaces.set(id, workspace);
    return workspace;
  }

  async updateWorkspace(id: number, workspace: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const existing = this.workspaces.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...workspace };
    this.workspaces.set(id, updated);
    return updated;
  }

  async deleteWorkspace(id: number): Promise<boolean> {
    return this.workspaces.delete(id);
  }

  // Task operations
  async getTask(id: number): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasks(workspaceId: number): Promise<Task[]> {
    const allTasks = Array.from(this.tasks.values());
    console.log(`Storage has ${allTasks.length} total tasks`);
    
    const filteredTasks = allTasks.filter(task => task.workspaceId === workspaceId);
    console.log(`Found ${filteredTasks.length} tasks for workspace ${workspaceId}`);
    
    return filteredTasks;
  }

  async getTasksByStatus(workspaceId: number, status: string): Promise<Task[]> {
    const tasks = Array.from(this.tasks.values())
      .filter(task => task.workspaceId === workspaceId && task.status === status);
    
    console.log(`Found ${tasks.length} tasks with status ${status} for workspace ${workspaceId}`);
    return tasks;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = this.taskId++;
    const task: Task = { ...insertTask, id };
    
    console.log(`Creating new task with ID ${id}:`, JSON.stringify(task));
    this.tasks.set(id, task);
    
    // Verify task was stored properly
    const storedTask = this.tasks.get(id);
    console.log(`Stored task (ID: ${id}):`, storedTask ? JSON.stringify(storedTask) : 'NOT FOUND');
    
    // Check task count
    console.log(`Storage now has ${this.tasks.size} total tasks`);
    
    return task;
  }

  async updateTask(id: number, taskUpdate: Partial<InsertTask>): Promise<Task | undefined> {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...taskUpdate };
    this.tasks.set(id, updated);
    return updated;
  }

  async updateTaskStatus(id: number, status: string): Promise<Task | undefined> {
    const existing = this.tasks.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, status };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: number): Promise<boolean> {
    // Also delete any subtasks and comments associated with this task
    Array.from(this.subtasks.values())
      .filter(subtask => subtask.taskId === id)
      .forEach(subtask => this.subtasks.delete(subtask.id));
    
    Array.from(this.comments.values())
      .filter(comment => comment.taskId === id)
      .forEach(comment => this.comments.delete(comment.id));
    
    return this.tasks.delete(id);
  }

  // Subtask operations
  async getSubtasks(taskId: number): Promise<Subtask[]> {
    return Array.from(this.subtasks.values())
      .filter(subtask => subtask.taskId === taskId);
  }

  async createSubtask(insertSubtask: InsertSubtask): Promise<Subtask> {
    const id = this.subtaskId++;
    const subtask: Subtask = { ...insertSubtask, id };
    this.subtasks.set(id, subtask);
    return subtask;
  }

  async updateSubtask(id: number, completed: boolean): Promise<Subtask | undefined> {
    const existing = this.subtasks.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, completed };
    this.subtasks.set(id, updated);
    return updated;
  }

  async deleteSubtask(id: number): Promise<boolean> {
    return this.subtasks.delete(id);
  }

  // Comment operations
  async getComments(taskId: number): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = this.commentId++;
    const comment: Comment = { 
      ...insertComment, 
      id, 
      createdAt: new Date() 
    };
    this.comments.set(id, comment);
    return comment;
  }

  async deleteComment(id: number): Promise<boolean> {
    return this.comments.delete(id);
  }

  // Get tasks by type (Sprint/AdHoc)
  async getTasksByType(workspaceId: number, taskType: string): Promise<Task[]> {
    const tasks = Array.from(this.tasks.values())
      .filter(task => task.workspaceId === workspaceId && task.taskType === taskType);
    
    console.log(`Found ${tasks.length} tasks with type ${taskType} for workspace ${workspaceId}`);
    return tasks;
  }

  // Get related tasks (tasks that have this task as a parent)
  async getRelatedTasks(parentTaskId: number): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.parentTaskId === parentTaskId);
  }
  
  // Get tasks that belong to a specific epic
  async getTasksByEpicId(epicId: number): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.epicId === epicId);
  }

  // Notification operations
  async getNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => {
        // Sort by creation time, newest first
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });
  }

  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId && !notification.isRead)
      .sort((a, b) => {
        // Sort by creation time, newest first
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.notificationId++;
    const notification: Notification = {
      ...insertNotification,
      id,
      isRead: false,
      createdAt: new Date()
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const existing = this.notifications.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, isRead: true };
    this.notifications.set(id, updated);
    return updated;
  }

  async deleteNotification(id: number): Promise<boolean> {
    return this.notifications.delete(id);
  }
}

export const storage = new MemStorage();
