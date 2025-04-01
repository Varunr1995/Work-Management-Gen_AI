import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertTaskSchema, insertSubtaskSchema, insertCommentSchema } from "@shared/schema";
import { emailService } from "./services/emailService";
import { schedulerService } from "./services/schedulerService";

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
    
    let tasks;
    if (status) {
      tasks = await storage.getTasksByStatus(workspaceId, status);
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
      
      // Validate required fields
      if (!emailAddress || !emailPassword) {
        return res.status(400).json({
          message: "Email address and password are required"
        });
      }
      
      // Configure the email service
      emailService.configure({
        emailAddress,
        emailPassword,
        imapHost: imapHost || 'imap.gmail.com',
        imapPort: imapPort || 993,
        emailLabel: emailLabel || 'taskflow'
      });
      
      res.json({
        success: true,
        message: "Email configuration saved",
        config: emailService.getConfig() // Returns config with password masked
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
      if (!emailService.isServiceConfigured()) {
        return res.status(400).json({ 
          message: "Email service not configured. Please configure email settings first." 
        });
      }

      // Process emails and create/update tasks
      const result = await emailService.processEmails();
      
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

  // Register API routes with prefix
  app.use('/api', apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
