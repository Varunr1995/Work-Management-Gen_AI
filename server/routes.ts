import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertTaskSchema, 
  insertSubtaskSchema, 
  insertCommentSchema,
  TaskSource,
  TaskType,
  TaskStatus,
  Task
} from "@shared/schema";
import { emailService } from "./services/emailService";
import { schedulerService } from "./services/schedulerService";
import { slackService } from "./services/slackService";

export async function registerRoutes(app: Express): Promise<Server> {
  const apiRouter = express.Router();
  
  // Users API
  apiRouter.get("/users", async (req: Request, res: Response) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  // Workspaces API
  apiRouter.get("/workspaces", async (req: Request, res: Response) => {
    const workspaces = await storage.getWorkspaces();
    res.json(workspaces);
  });

  apiRouter.get("/workspaces/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const workspace = await storage.getWorkspace(id);
    
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    
    res.json(workspace);
  });

  // Tasks API
  apiRouter.get("/workspaces/:workspaceId/tasks", async (req: Request, res: Response) => {
    const workspaceId = parseInt(req.params.workspaceId);
    const status = req.query.status as string | undefined;
    const taskType = req.query.taskType as string | undefined;
    
    let tasks;
    if (status) {
      tasks = await storage.getTasksByStatus(workspaceId, status);
    } else if (taskType) {
      tasks = await storage.getTasksByType(workspaceId, taskType);
    } else {
      tasks = await storage.getTasks(workspaceId);
    }
    
    console.log(`Retrieved ${tasks.length} tasks for workspace ${workspaceId}:`, JSON.stringify(tasks));
    
    res.json(tasks);
  });

  apiRouter.get("/tasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const task = await storage.getTask(id);
    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    res.json(task);
  });

  apiRouter.post("/tasks", async (req: Request, res: Response) => {
    try {
      console.log("Creating task with data:", JSON.stringify(req.body));
      // Parse the task data with the insert schema - handle date conversions
      const taskData = {
        ...req.body,
        // Convert dates if present
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };
      
      const validatedData = insertTaskSchema.parse(taskData);
      console.log("Validated task data:", JSON.stringify(validatedData));
      const task = await storage.createTask(validatedData);
      console.log("Created task:", JSON.stringify(task));
      
      // Create a notification for the new task
      const notification = {
        title: "New Task Created",
        message: `Task "${task.title}" has been created${task.taskType ? ` with type: ${task.taskType}` : ''}${task.priority ? ` | Priority: ${task.priority}` : ''}${task.dueDate ? ` | Due: ${new Date(task.dueDate).toLocaleDateString()}` : ''}`,
        taskId: task.id,
        userId: 1, // Admin user (change to assigneeId if assignee exists)
        type: "task_created",
        isRead: false,
        createdAt: new Date()
      };
      
      try {
        const createdNotification = await storage.createNotification(notification);
        console.log("Created notification:", JSON.stringify(createdNotification));
      } catch (notificationError) {
        console.error("Failed to create notification:", notificationError);
      }
      
      // Log all tasks in storage after creation
      const allTasks = await storage.getTasks(task.workspaceId);
      console.log(`All tasks after creation (${allTasks.length}):`, JSON.stringify(allTasks));
      
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", JSON.stringify(error.errors));
        return res.status(400).json({ 
          message: "Invalid task data", 
          errors: error.errors 
        });
      }
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  apiRouter.patch("/tasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    
    try {
      // Use Zod to validate partial task updates
      const taskUpdateData = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(id, taskUpdateData);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // Create a notification for the task update if significant fields were updated
      const significantFields = [];
      if ('status' in taskUpdateData && taskUpdateData.status) significantFields.push(`Status: ${taskUpdateData.status}`);
      if ('priority' in taskUpdateData && taskUpdateData.priority) significantFields.push(`Priority: ${taskUpdateData.priority}`);
      if ('assigneeId' in taskUpdateData && taskUpdateData.assigneeId) significantFields.push(`Assigned to user ID: ${taskUpdateData.assigneeId}`);
      if ('dueDate' in taskUpdateData && taskUpdateData.dueDate) significantFields.push(`Due date: ${new Date(taskUpdateData.dueDate).toLocaleDateString()}`);
      if ('taskType' in taskUpdateData && taskUpdateData.taskType) significantFields.push(`Task type: ${taskUpdateData.taskType}`);
      
      if (significantFields.length > 0) {
        try {
          const notification = {
            title: "Task Updated",
            message: `Task "${task.title}" was updated: ${significantFields.join(' | ')}`,
            taskId: task.id,
            userId: 1, // Admin user (should be changed to the appropriate user in a real app)
            type: "task_updated",
            isRead: false,
            createdAt: new Date()
          };
          
          const createdNotification = await storage.createNotification(notification);
          console.log("Created update notification:", JSON.stringify(createdNotification));
        } catch (notificationError) {
          console.error("Failed to create update notification:", notificationError);
        }
      }
      
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid task data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  apiRouter.patch("/tasks/:id/status", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    
    const task = await storage.updateTaskStatus(id, status);
    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    // Create a notification for the status change
    try {
      const notification = {
        title: "Task Status Changed",
        message: `Task "${task.title}" status changed to: ${status}`,
        taskId: task.id,
        userId: 1, // Admin user (should be the appropriate user in a real app)
        type: "task_status_changed",
        isRead: false,
        createdAt: new Date()
      };
      
      const createdNotification = await storage.createNotification(notification);
      console.log("Created status notification:", JSON.stringify(createdNotification));
    } catch (notificationError) {
      console.error("Failed to create status notification:", notificationError);
    }
    
    res.json(task);
  });

  apiRouter.delete("/tasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteTask(id);
    
    if (!success) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    res.status(204).send();
  });

  // Subtasks API
  apiRouter.get("/tasks/:taskId/subtasks", async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const subtasks = await storage.getSubtasks(taskId);
    res.json(subtasks);
  });

  apiRouter.post("/subtasks", async (req: Request, res: Response) => {
    try {
      const subtaskData = insertSubtaskSchema.parse(req.body);
      const subtask = await storage.createSubtask(subtaskData);
      res.status(201).json(subtask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid subtask data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create subtask" });
    }
  });

  apiRouter.patch("/subtasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { completed } = req.body;
    
    if (completed === undefined) {
      return res.status(400).json({ message: "Completed status is required" });
    }
    
    const subtask = await storage.updateSubtask(id, completed);
    
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }
    
    res.json(subtask);
  });

  apiRouter.delete("/subtasks/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteSubtask(id);
    
    if (!success) {
      return res.status(404).json({ message: "Subtask not found" });
    }
    
    res.status(204).send();
  });

  // Comments API
  apiRouter.get("/tasks/:taskId/comments", async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const comments = await storage.getComments(taskId);
    res.json(comments);
  });

  apiRouter.post("/comments", async (req: Request, res: Response) => {
    try {
      const commentData = insertCommentSchema.parse(req.body);
      const comment = await storage.createComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid comment data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  apiRouter.delete("/comments/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteComment(id);
    
    if (!success) {
      return res.status(404).json({ message: "Comment not found" });
    }
    
    res.status(204).send();
  });

  // Email integration API
  apiRouter.post("/email/configure", async (req: Request, res: Response) => {
    try {
      const { emailAddress, emailPassword, imapHost, imapPort, emailLabel } = req.body;
      
      console.log('Configuring email with:', {
        emailAddress,
        imapHost: imapHost || 'imap.gmail.com',
        imapPort: imapPort || 993,
        emailLabel: emailLabel || 'taskflow',
        passwordProvided: !!emailPassword
      });
      
      // Validate required fields
      if (!emailAddress || !emailPassword) {
        return res.status(400).json({
          message: "Email address and password are required"
        });
      }
      
      // Configure the email service and test connection
      const success = await emailService.configure({
        emailAddress,
        emailPassword,
        imapHost: imapHost || 'imap.gmail.com',
        imapPort: imapPort || 993,
        emailLabel: emailLabel || 'INBOX'
      });
      
      console.log('Email service configuration result:', {
        success,
        isConfigured: emailService.isServiceConfigured()
      });
      
      if (!success) {
        return res.status(400).json({
          message: "Email configuration failed. Could not establish IMAP connection. Please check your credentials and settings."
        });
      }
      
      res.json({
        success: true,
        message: "Email configuration saved and connection tested successfully",
        config: emailService.getConfig(), // Returns config with password masked
        isConfigured: emailService.isServiceConfigured()
      });
    } catch (error) {
      console.error('Error configuring email service:', error);
      res.status(500).json({
        message: "Failed to configure email service",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  apiRouter.post("/email/check", async (req: Request, res: Response) => {
    try {
      // Check if email service is configured
      console.log('Check emails requested. Is email service configured?', emailService.isServiceConfigured());
      console.log('Current email configuration:', emailService.getConfig());
      
      if (!emailService.isServiceConfigured()) {
        console.log('Email service not configured, returning 400');
        return res.status(400).json({ 
          message: "Email service not configured. Please configure email settings first." 
        });
      }

      console.log('Email service configured, proceeding to check emails...');
      
      // Process emails and create/update tasks
      const result = await emailService.processEmails();
      console.log('Email processing results:', result);
      
      res.json({ 
        success: true, 
        message: `Processed emails: created ${result.tasksCreated} new task(s) and updated ${result.tasksUpdated} task(s)`,
        tasksCreated: result.tasksCreated,
        tasksUpdated: result.tasksUpdated
      });
    } catch (error) {
      console.error('Error checking emails:', error);
      res.status(500).json({ 
        message: "Failed to check emails",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  apiRouter.post("/email/scheduler/start", async (req: Request, res: Response) => {
    try {
      const { intervalMinutes } = req.body;
      
      // Check if email service is configured
      if (!emailService.isServiceConfigured()) {
        return res.status(400).json({ 
          message: "Email service not configured. Please configure email settings first." 
        });
      }

      // Start the scheduler with the provided interval or default (5 minutes)
      schedulerService.startEmailChecker(intervalMinutes || 5);
      
      res.json({ 
        success: true, 
        message: `Email scheduler started with ${intervalMinutes || 5} minute interval` 
      });
    } catch (error) {
      console.error('Error starting email scheduler:', error);
      res.status(500).json({ 
        message: "Failed to start email scheduler",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  apiRouter.post("/email/scheduler/stop", async (req: Request, res: Response) => {
    try {
      // Stop the email checking scheduler
      schedulerService.stopEmailChecker();
      
      res.json({ 
        success: true, 
        message: "Email scheduler stopped" 
      });
    } catch (error) {
      console.error('Error stopping email scheduler:', error);
      res.status(500).json({ 
        message: "Failed to stop email scheduler",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Epic Documentation Generation
  apiRouter.post("/epics/:epicId/generate-documentation", async (req: Request, res: Response) => {
    try {
      const epicId = parseInt(req.params.epicId);
      
      // Get the epic task
      const epic = await storage.getTask(epicId);
      if (!epic) {
        return res.status(404).json({ message: "Epic not found" });
      }
      
      // Verify this is actually an epic
      if (epic.taskType !== TaskType.EPIC) {
        return res.status(400).json({ message: "Task is not an epic" });
      }
      
      // Get all tasks linked to this epic
      const linkedTasks = await storage.getTasksByEpicId(epicId);
      
      // Generate documentation from epic and linked tasks
      const documentContent = `
# Epic: ${epic.title}

## Overview
${epic.description}

## Timeline
* Start Date: ${epic.startDate ? new Date(epic.startDate).toLocaleDateString() : 'Not specified'}
* End Date: ${epic.dueDate ? new Date(epic.dueDate).toLocaleDateString() : 'Not specified'}

## Tasks
${linkedTasks.map((task: Task) => 
  `### ${task.title} (${task.status})
  * Priority: ${task.priority}
  * ${task.description || 'No description'}`
).join('\n\n')}

## Summary
This epic contains ${linkedTasks.length} tasks, of which ${linkedTasks.filter((t: Task) => t.status === TaskStatus.COMPLETED).length} are completed.
      `;
      
      console.log("Generated documentation for epic", epicId, documentContent);
      
      // Create a notification for the documentation
      const notification = {
        title: "Epic Documentation Generated",
        message: `Documentation for epic "${epic.title}" has been generated.`,
        taskId: epicId,
        userId: 1, // Admin user (can be changed in a real app)
        type: "epic_documentation",
        isRead: false,
        createdAt: new Date()
      };
      
      const createdNotification = await storage.createNotification(notification);
      
      res.json({
        success: true,
        epicId,
        documentation: documentContent,
        notification: createdNotification
      });
      
    } catch (error) {
      console.error('Error generating epic documentation:', error);
      res.status(500).json({ 
        message: "Failed to generate epic documentation",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Slack integration API
  apiRouter.post("/slack/configure", async (req: Request, res: Response) => {
    try {
      const { botToken, channelId } = req.body;
      
      console.log('Configuring Slack with:', {
        channelId,
        botTokenProvided: !!botToken
      });
      
      // Validate required fields
      if (!botToken || !channelId) {
        return res.status(400).json({
          message: "Slack Bot Token and Channel ID are required"
        });
      }
      
      // Configure the Slack service and test connection
      const success = await slackService.configure({
        botToken,
        channelId
      });
      
      console.log('Slack service configuration result:', {
        success,
        isConfigured: slackService.isServiceConfigured()
      });
      
      if (!success) {
        return res.status(400).json({
          message: "Slack configuration failed. Could not establish connection. Please check your credentials and settings."
        });
      }
      
      res.json({
        success: true,
        message: "Slack configuration saved and connection tested successfully",
        config: slackService.getConfig(), // Returns config with token masked
        isConfigured: slackService.isServiceConfigured()
      });
    } catch (error) {
      console.error('Error configuring Slack service:', error);
      res.status(500).json({
        message: "Failed to configure Slack service",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  apiRouter.post("/slack/check", async (req: Request, res: Response) => {
    try {
      // Check if Slack service is configured
      console.log('Check Slack messages requested. Is Slack service configured?', slackService.isServiceConfigured());
      console.log('Current Slack configuration:', slackService.getConfig());
      
      if (!slackService.isServiceConfigured()) {
        console.log('Slack service not configured, returning 400');
        return res.status(400).json({ 
          message: "Slack service not configured. Please configure Slack settings first." 
        });
      }

      console.log('Slack service configured, proceeding to check messages...');
      
      // Process Slack messages and create tasks
      const result = await slackService.processMessages();
      console.log('Slack processing results:', result);
      
      res.json({ 
        success: true, 
        message: `Processed Slack messages: created ${result.tasksCreated} new task(s) and detected ${result.duplicatesDetected} duplicate(s)`,
        tasksCreated: result.tasksCreated,
        duplicatesDetected: result.duplicatesDetected
      });
    } catch (error) {
      console.error('Error checking Slack messages:', error);
      res.status(500).json({ 
        message: "Failed to check Slack messages",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  apiRouter.post("/slack/send", async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      if (!slackService.isServiceConfigured()) {
        return res.status(400).json({ 
          message: "Slack service not configured. Please configure Slack settings first." 
        });
      }
      
      const messageId = await slackService.sendMessage(message);
      
      res.json({ 
        success: true, 
        message: "Message sent to Slack channel successfully",
        messageId
      });
    } catch (error) {
      console.error('Error sending Slack message:', error);
      res.status(500).json({ 
        message: "Failed to send Slack message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Notification routes
  
  // Get unread notifications for a user
  apiRouter.get("/notifications/unread/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const notifications = await storage.getUnreadNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      res.status(500).json({ 
        message: "Failed to get unread notifications",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Mark a notification as read
  apiRouter.patch("/notifications/:id/read", async (req: Request, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      
      if (!updatedNotification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(updatedNotification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ 
        message: "Failed to mark notification as read",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Mark all notifications as read for a user
  apiRouter.patch("/notifications/mark-all-read/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const unreadNotifications = await storage.getUnreadNotifications(userId);
      
      const markReadPromises = unreadNotifications.map(notification => 
        storage.markNotificationAsRead(notification.id)
      );
      
      await Promise.all(markReadPromises);
      
      res.json({ 
        success: true, 
        message: "All notifications marked as read" 
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ 
        message: "Failed to mark all notifications as read",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get all notifications for a user
  apiRouter.get("/notifications/:userId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ 
        message: "Failed to get notifications",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Sample epics endpoint for testing
  apiRouter.post("/sample-epics", async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.body.workspaceId || "1");
      
      // Create 4 sample epics
      const epicData = [
        {
          title: "Product Launch Campaign",
          description: "Full marketing campaign for the new product launch including social media, email, and PR activities.",
          status: TaskStatus.IN_PROGRESS,
          priority: "high",
          assigneeId: 1,
          workspaceId: workspaceId,
          dueDate: new Date("2023-11-15"),
          startDate: new Date("2023-09-01"),
          taskType: TaskType.EPIC
        },
        {
          title: "Website Revamp Project",
          description: "Complete redesign and development of the company website with new branding and improved UX.",
          status: TaskStatus.TODO,
          priority: "high",
          assigneeId: 2,
          workspaceId: workspaceId,
          dueDate: new Date("2023-12-20"),
          startDate: new Date("2023-10-01"),
          taskType: TaskType.EPIC
        },
        {
          title: "Q4 Client Onboarding Improvements",
          description: "Project to streamline and enhance the client onboarding process for Q4.",
          status: TaskStatus.IN_REVIEW,
          priority: "medium",
          assigneeId: 3,
          workspaceId: workspaceId,
          dueDate: new Date("2023-11-30"),
          startDate: new Date("2023-09-15"),
          taskType: TaskType.EPIC
        },
        {
          title: "Mobile App Enhancement",
          description: "Series of updates and new features for the mobile application.",
          status: TaskStatus.TODO,
          priority: "low",
          assigneeId: 1,
          workspaceId: workspaceId,
          dueDate: new Date("2024-01-15"),
          startDate: new Date("2023-11-01"),
          taskType: TaskType.EPIC
        }
      ];
      
      const createdEpics = [];
      
      for (const epic of epicData) {
        const createdEpic = await storage.createTask(epic);
        createdEpics.push(createdEpic);
      }
      
      res.json({ 
        success: true, 
        message: "Sample epics created successfully", 
        epics: createdEpics 
      });
    } catch (error) {
      console.error("Error creating sample epics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Register API routes with prefix
  app.use('/api', apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
