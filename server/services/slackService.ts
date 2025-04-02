import { type ChatPostMessageArguments, WebClient } from "@slack/web-api";
import { 
  TaskPriority, 
  TaskStatus, 
  TaskType, 
  TaskSource, 
  type InsertTask, 
  type InsertNotification, 
  type Task 
} from "@shared/schema";
import { storage } from "../storage";

interface SlackConfig {
  botToken: string;
  channelId: string;
}

type ConversationsHistoryResponse = {
  ok: boolean;
  messages?: {
    type: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    reply_count?: number;
    replies?: { user: string; ts: string }[];
  }[];
  has_more?: boolean;
  pin_count?: number;
  response_metadata?: {
    next_cursor: string;
  };
}

/**
 * Service for integrating with Slack
 */
export class SlackService {
  private config: SlackConfig | null = null;
  private slackClient: WebClient | null = null;
  private isConfigured = false;
  private existingTasksByMessageId: Map<string, Task> = new Map();

  constructor() {
    this.initFromEnvironment();
  }

  /**
   * Initialize from environment variables if available
   */
  private initFromEnvironment() {
    console.log('Loading Slack configuration from environment variables');
    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
      this.configure({
        botToken: process.env.SLACK_BOT_TOKEN,
        channelId: process.env.SLACK_CHANNEL_ID,
      }).catch(err => {
        console.error('Failed to initialize Slack from environment:', err);
      });
    }
  }

  /**
   * Configure the Slack service with user-provided settings
   * @returns Promise that resolves to true if connection test was successful
   */
  async configure(config: SlackConfig): Promise<{success: boolean; error?: string}> {
    this.config = config;
    
    try {
      this.slackClient = new WebClient(config.botToken);
      
      // Test the connection by fetching channel info
      const result = await this.slackClient.conversations.info({
        channel: config.channelId
      });
      
      if (result.ok) {
        this.isConfigured = true;
        console.log('Slack service configured successfully');
        console.log('Channel info:', JSON.stringify({
          name: result?.channel?.name,
          is_channel: result?.channel?.is_channel,
          is_group: result?.channel?.is_group,
          is_private: result?.channel?.is_private
        }));
        await this.loadExistingTasks();
        return { success: true };
      } else {
        console.error('Slack API returned ok=false:', result);
        this.isConfigured = false;
        return { 
          success: false, 
          error: result.error || 'Invalid response from Slack API'
        };
      }
    } catch (error: any) {
      console.error('Error configuring Slack service:', error);
      this.isConfigured = false;
      return { 
        success: false, 
        error: error.message || 'Failed to connect to Slack API'
      };
    }
  }

  /**
   * Load existing tasks with slack message IDs into the map
   */
  private async loadExistingTasks(): Promise<void> {
    if (!this.isConfigured) return;
    
    try {
      // Get all tasks with source=slack
      const tasks = await storage.getTasks(1); // Assuming workspace ID 1 for now
      
      this.existingTasksByMessageId.clear();
      
      for (const task of tasks) {
        if (task.source === TaskSource.SLACK && task.slackMessageId) {
          this.existingTasksByMessageId.set(task.slackMessageId, task);
        }
      }
      
      console.log(`Loaded ${this.existingTasksByMessageId.size} existing Slack tasks`);
    } catch (error) {
      console.error('Error loading existing Slack tasks:', error);
    }
  }

  /**
   * Check if the service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured && !!this.slackClient && !!this.config;
  }

  /**
   * Get current configuration with token masked
   */
  getConfig(): Partial<SlackConfig> | null {
    if (!this.config) return null;
    
    return {
      channelId: this.config.channelId,
      botToken: this.config.botToken ? '***masked***' : undefined,
    };
  }

  /**
   * Send a message to the configured Slack channel
   */
  async sendMessage(message: string): Promise<string | undefined> {
    if (!this.isConfigured || !this.slackClient || !this.config) {
      throw new Error('Slack service not configured');
    }
    
    try {
      const result = await this.slackClient.chat.postMessage({
        channel: this.config.channelId,
        text: message,
      });
      
      return result.ts;
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }

  /**
   * Fetch recent messages from the configured channel
   */
  async fetchChannelMessages(limit: number = 50): Promise<any[]> {
    if (!this.isConfigured || !this.slackClient || !this.config) {
      throw new Error('Slack service not configured');
    }
    
    try {
      const result = await this.slackClient.conversations.history({
        channel: this.config.channelId,
        limit,
      });
      
      if (!result.ok || !result.messages) {
        console.error('Error fetching messages:', result);
        return [];
      }
      
      return result.messages;
    } catch (error) {
      console.error('Error fetching Slack channel messages:', error);
      throw error;
    }
  }

  /**
   * Parse a Slack message to extract task information
   */
  parseMessage(message: any): Partial<InsertTask> | null {
    if (!message || !message.text) {
      return null;
    }
    
    try {
      const text = message.text.trim();
      
      // Basic parsing - can be enhanced with more sophisticated parsing
      let taskData: Partial<InsertTask> = {
        title: text.split('\n')[0].slice(0, 100), // First line as title, limit to 100 chars
        description: text,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        taskType: TaskType.ADHOC,
        source: TaskSource.SLACK,
        slackMessageId: message.ts,
        workspaceId: 1, // Default workspace ID
      };
      
      // If this message is a thread reply, set parentTaskId
      if (message.thread_ts && message.thread_ts !== message.ts) {
        // Find parent task by thread_ts
        const tasks = Array.from(this.existingTasksByMessageId.values());
        const parentTask = tasks.find(t => t.slackMessageId === message.thread_ts);
        
        if (parentTask) {
          taskData.parentTaskId = parentTask.id;
          // For thread replies that look like followups to the original task
          taskData.title = `Reply: ${taskData.title}`;
        }
      }
      
      return taskData;
    } catch (error) {
      console.error('Error parsing Slack message:', error);
      return null;
    }
  }

  /**
   * Check for duplicate tasks based on title/content
   */
  async checkForDuplicateTask(taskData: Partial<InsertTask>): Promise<Task | null> {
    if (!taskData.title) return null;
    
    try {
      const tasks = await storage.getTasks(taskData.workspaceId || 1);
      
      // Compare by title (exact match)
      const duplicate = tasks.find(task => 
        task.source !== TaskSource.SLACK && // Only check non-Slack tasks
        task.title === taskData.title
      );
      
      return duplicate || null;
    } catch (error) {
      console.error('Error checking for duplicate tasks:', error);
      return null;
    }
  }

  /**
   * Create a task from a Slack message, handling duplicates
   */
  async createTaskFromMessage(message: any): Promise<{task: Task | null, isDuplicate: boolean}> {
    if (!this.isConfigured) {
      throw new Error('Slack service not configured');
    }
    
    // Skip if we already processed this message
    if (message.ts && this.existingTasksByMessageId.has(message.ts)) {
      return {
        task: this.existingTasksByMessageId.get(message.ts) || null,
        isDuplicate: false
      };
    }
    
    const taskData = this.parseMessage(message);
    
    if (!taskData) {
      return { task: null, isDuplicate: false };
    }
    
    // Check for duplicates with existing tasks
    const duplicate = await this.checkForDuplicateTask(taskData);
    
    if (duplicate) {
      // For duplicates, create a completed task with reference to the original
      const duplicateTaskData: InsertTask = {
        title: taskData.title || 'Untitled task',
        description: `Duplicate of existing task: ${duplicate.title}\n\nOriginal content:\n${taskData.description}`,
        status: TaskStatus.COMPLETED,
        priority: taskData.priority || TaskPriority.MEDIUM,
        workspaceId: taskData.workspaceId || 1,
        completed: true,
        position: 0,
        taskType: taskData.taskType || TaskType.ADHOC,
        source: TaskSource.SLACK,
        slackMessageId: taskData.slackMessageId,
      };
      
      const task = await storage.createTask(duplicateTaskData);
      
      // Create notification about duplicate task
      const notification: InsertNotification = {
        title: "Duplicate Task Detected",
        message: `Task "${task.title}" was created from Slack but marked as completed because it's a duplicate of existing task "${duplicate.title}"`,
        userId: 1, // Admin user
        taskId: task.id,
        type: "task_duplicate",
      };
      
      await storage.createNotification(notification);
      
      if (task.slackMessageId) {
        this.existingTasksByMessageId.set(task.slackMessageId, task);
      }
      
      return { task, isDuplicate: true };
    }
    
    // Create new task from non-duplicate message
    const newTask: InsertTask = {
      title: taskData.title || 'Untitled task',
      description: taskData.description || '',
      status: taskData.status || TaskStatus.TODO,
      priority: taskData.priority || TaskPriority.MEDIUM,
      workspaceId: taskData.workspaceId || 1,
      completed: false,
      position: 0,
      taskType: taskData.taskType || TaskType.ADHOC,
      parentTaskId: taskData.parentTaskId,
      source: TaskSource.SLACK,
      slackMessageId: taskData.slackMessageId,
    };
    
    const task = await storage.createTask(newTask);
    
    // Create notification about new task from Slack
    const notification: InsertNotification = {
      title: "New Slack Task",
      message: `Task "${task.title}" was created from Slack channel`,
      userId: 1, // Admin user
      taskId: task.id,
      type: "task_created_slack",
    };
    
    await storage.createNotification(notification);
    
    if (task.slackMessageId) {
      this.existingTasksByMessageId.set(task.slackMessageId, task);
    }
    
    return { task, isDuplicate: false };
  }

  /**
   * Process new Slack messages and create tasks
   */
  async processMessages(): Promise<{ tasksCreated: number, duplicatesDetected: number }> {
    if (!this.isConfigured) {
      throw new Error('Slack service not configured');
    }
    
    let tasksCreated = 0;
    let duplicatesDetected = 0;
    
    try {
      const messages = await this.fetchChannelMessages();
      console.log(`Processing ${messages.length} Slack messages`);
      
      for (const message of messages) {
        // Skip system messages and bot messages
        if (message.subtype || message.bot_id) continue;
        
        const result = await this.createTaskFromMessage(message);
        
        if (result.task) {
          if (result.isDuplicate) {
            duplicatesDetected++;
          } else {
            tasksCreated++;
          }
        }
      }
      
      return { tasksCreated, duplicatesDetected };
    } catch (error) {
      console.error('Error processing Slack messages:', error);
      throw error;
    }
  }
}

export const slackService = new SlackService();