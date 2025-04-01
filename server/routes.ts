import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertTaskSchema, insertSubtaskSchema, insertCommentSchema } from "@shared/schema";
import { gmailService } from "./services/emailService";
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
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid task data", 
          errors: error.errors 
        });
      }
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
  apiRouter.post("/email/check", async (req: Request, res: Response) => {
    try {
      // Check if required Gmail secrets are set
      if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
        return res.status(400).json({ 
          message: "Gmail credentials not configured", 
          missingCredentials: {
            clientId: !process.env.GMAIL_CLIENT_ID,
            clientSecret: !process.env.GMAIL_CLIENT_SECRET,
            refreshToken: !process.env.GMAIL_REFRESH_TOKEN
          }
        });
      }

      // Process emails and create tasks
      const tasks = await gmailService.processEmails();
      
      res.json({ 
        success: true, 
        message: `Processed emails and created ${tasks.length} new task(s)`,
        tasks 
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
      
      // Check if required Gmail secrets are set
      if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
        return res.status(400).json({ 
          message: "Gmail credentials not configured", 
          missingCredentials: {
            clientId: !process.env.GMAIL_CLIENT_ID,
            clientSecret: !process.env.GMAIL_CLIENT_SECRET,
            refreshToken: !process.env.GMAIL_REFRESH_TOKEN
          }
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
