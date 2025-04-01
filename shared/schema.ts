import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  email: text("email"),
  role: text("role").default("user"), // 'user' or 'admin'
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  avatarUrl: true,
  email: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Workspaces table
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).pick({
  name: true,
  description: true,
});

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

// Task statuses
export const TaskStatus = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  IN_REVIEW: "in_review",
  COMPLETED: "completed",
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

// Task priorities
export const TaskPriority = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type TaskPriorityType = typeof TaskPriority[keyof typeof TaskPriority];

// Task types
export const TaskType = {
  SPRINT: "sprint",
  ADHOC: "adhoc",
} as const;

export type TaskTypeValue = typeof TaskType[keyof typeof TaskType];

// Tasks table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default(TaskStatus.TODO),
  priority: text("priority").notNull().default(TaskPriority.MEDIUM),
  assigneeId: integer("assignee_id").references(() => users.id),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  dueDate: timestamp("due_date"),
  startDate: timestamp("start_date"),
  completed: boolean("completed").default(false),
  position: integer("position").default(0),
  taskType: text("task_type").default(TaskType.ADHOC), // 'sprint' or 'adhoc'
  parentTaskId: integer("parent_task_id").references(() => tasks.id), // For handling RE: emails
  emailThreadId: text("email_thread_id"), // For identifying email threads
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  title: true,
  description: true,
  status: true,
  priority: true,
  assigneeId: true,
  workspaceId: true,
  dueDate: true,
  startDate: true,
  completed: true,
  position: true,
  taskType: true,
  parentTaskId: true,
  emailThreadId: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Subtasks table
export const subtasks = pgTable("subtasks", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
});

export const insertSubtaskSchema = createInsertSchema(subtasks).pick({
  taskId: true,
  title: true,
  completed: true,
});

export type InsertSubtask = z.infer<typeof insertSubtaskSchema>;
export type Subtask = typeof subtasks.$inferSelect;

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  taskId: true,
  userId: true,
  content: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  taskId: integer("task_id").references(() => tasks.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  type: text("type").default("task_created"), // 'task_created', 'task_updated', 'task_assigned', 'task_due', etc.
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  taskId: true,
  title: true,
  message: true,
  type: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
