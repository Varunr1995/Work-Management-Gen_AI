import Imap from 'node-imap';
import { simpleParser } from 'mailparser';

// Fix for ParsedMail typing issues
type ParsedMail = {
  text?: string;
  subject?: string;
  messageId?: string;
};
import { Task, TaskPriority, TaskStatus, InsertTask } from '@shared/schema';
import { storage } from '../storage';

// Interface for parsed email data
interface ParsedEmailData {
  subject: string;
  body: string;
  team?: string;
  assignee?: string;
  deadline?: Date;
  priority?: string;
  workspaceId: number;
  messageId?: string;
}

// Interface for email configuration
interface EmailConfig {
  emailAddress: string;
  emailPassword: string;
  imapHost: string;
  imapPort: number;
  emailLabel: string;
}

// Class to handle email operations via IMAP
export class EmailService {
  private config: EmailConfig | null = null;
  private imap: Imap | null = null;
  
  // Flag to determine if the service is properly configured
  private isConfigured = false;
  
  // Store existing tasks by messageId to update instead of duplicate
  private existingTasksByMessageId: Map<string, Task> = new Map();

  constructor() {
    // Try to load from environment variables first (legacy support)
    if (process.env.EMAIL_ADDRESS && process.env.GMAIL_APP_PASSWORD) {
      this.config = {
        emailAddress: process.env.EMAIL_ADDRESS,
        emailPassword: process.env.GMAIL_APP_PASSWORD,
        imapHost: process.env.IMAP_HOST || 'imap.gmail.com',
        imapPort: process.env.IMAP_PORT ? parseInt(process.env.IMAP_PORT) : 993,
        emailLabel: process.env.EMAIL_LABEL || 'taskflow'
      };
      this.isConfigured = true;
      this.initializeImap();
    }
  }

  /**
   * Configure the email service with user-provided settings
   */
  configure(config: EmailConfig): void {
    this.config = config;
    this.isConfigured = true;
    this.initializeImap();
  }

  /**
   * Check if the service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured && this.config !== null;
  }

  /**
   * Initialize IMAP connection with current config
   */
  private initializeImap(): void {
    if (!this.config) return;
    
    this.imap = new Imap({
      user: this.config.emailAddress,
      password: this.config.emailPassword,
      host: this.config.imapHost,
      port: this.config.imapPort,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });
  }

  /**
   * Fetch unread emails from the configured account
   */
  async fetchUnreadEmails(): Promise<ParsedMail[]> {
    if (!this.isServiceConfigured() || !this.imap) {
      throw new Error('Email service not configured. Please configure the service first.');
    }

    return new Promise((resolve, reject) => {
      const emails: ParsedMail[] = [];
      const processedUIDs: number[] = [];
    
      this.imap!.once('ready', () => {
        this.imap!.openBox(this.config!.emailLabel, false, (err, box) => {
          if (err) {
            console.error('Error opening mailbox:', err);
            this.imap!.end();
            return reject(err);
          }
          
          // Search for unread messages
          this.imap!.search(['UNSEEN'], (err, results) => {
            if (err) {
              console.error('Error searching emails:', err);
              this.imap!.end();
              return reject(err);
            }
            
            if (results.length === 0) {
              this.imap!.end();
              return resolve([]);
            }
            
            const f = this.imap!.fetch(results, { 
              bodies: '',
              markSeen: true 
            });
            
            f.on('message', (msg, seqno) => {
              let uid: number;
              
              msg.once('attributes', (attrs) => {
                uid = attrs.uid;
                processedUIDs.push(uid);
              });
              
              msg.on('body', (stream, info) => {
                let buffer = '';
                
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                
                stream.once('end', async () => {
                  try {
                    const parsedEmail = await simpleParser(buffer);
                    emails.push(parsedEmail);
                  } catch (error) {
                    console.error('Error parsing email:', error);
                  }
                });
              });
            });
            
            f.once('error', (err) => {
              console.error('Error fetching emails:', err);
              reject(err);
            });
            
            f.once('end', () => {
              this.imap!.end();
              resolve(emails);
            });
          });
        });
      });
      
      this.imap!.once('error', (err) => {
        console.error('IMAP error:', err);
        reject(err);
      });
      
      this.imap!.connect();
    });
  }

  /**
   * Parse an email to extract task information
   */
  parseEmail(email: ParsedMail): ParsedEmailData | null {
    try {      
      // Get the email body
      const emailBody = email.text || '';
      const subject = email.subject || 'No Subject';
      const messageId = email.messageId || '';

      // Parse the email body for task details
      const parsedData: ParsedEmailData = {
        subject,
        body: emailBody,
        workspaceId: 1,  // Default workspace ID
        messageId
      };

      // Extract team information
      const teamMatch = emailBody.match(/Team:\s*([^\n]+)/i);
      if (teamMatch && teamMatch[1]) {
        parsedData.team = teamMatch[1].trim();
      }

      // Extract assignee
      const assigneeMatch = emailBody.match(/Assignee:\s*([^\n]+)/i);
      if (assigneeMatch && assigneeMatch[1]) {
        parsedData.assignee = assigneeMatch[1].trim();
      }

      // Extract deadline
      const deadlineMatch = emailBody.match(/Deadline:\s*([^\n]+)/i);
      if (deadlineMatch && deadlineMatch[1]) {
        const deadlineStr = deadlineMatch[1].trim();
        const deadlineDate = new Date(deadlineStr);
        
        // Check if the date is valid
        if (!isNaN(deadlineDate.getTime())) {
          parsedData.deadline = deadlineDate;
        }
      }

      // Extract priority
      const priorityMatch = emailBody.match(/Priority:\s*(high|medium|low)/i);
      if (priorityMatch && priorityMatch[1]) {
        parsedData.priority = priorityMatch[1].toLowerCase();
      }

      return parsedData;
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  /**
   * Create or update a task from parsed email data
   */
  async createOrUpdateTaskFromEmail(parsedData: ParsedEmailData): Promise<{ task: Task | null, isNew: boolean }> {
    try {
      // Check if we should update an existing task based on message ID
      let existingTask: Task | undefined = undefined;
      let isNewTask = true;
      
      if (parsedData.messageId) {
        // In a real implementation, we would look up tasks by message ID in a database
        // For this implementation, we'll simulate this with our in-memory map
        existingTask = this.existingTasksByMessageId.get(parsedData.messageId);
        
        if (existingTask) {
          isNewTask = false;
        }
      }

      // Find assignee ID based on name if available
      let assigneeId: number | null = null;
      if (parsedData.assignee) {
        const users = await storage.getUsers();
        const assignee = users.find(user => 
          user.displayName.toLowerCase() === parsedData.assignee?.toLowerCase()
        );
        if (assignee) {
          assigneeId = assignee.id;
        }
      }

      // Determine priority
      let priority: "low" | "medium" | "high" = "medium";
      if (parsedData.priority) {
        const priorityValue = parsedData.priority.toLowerCase();
        if (priorityValue === 'high') {
          priority = "high";
        } else if (priorityValue === 'medium') {
          priority = "medium";
        } else if (priorityValue === 'low') {
          priority = "low";
        }
      }

      // If we're updating an existing task
      if (!isNewTask && existingTask) {
        const updatedTask = await storage.updateTask(existingTask.id, {
          title: parsedData.subject,
          description: `${parsedData.body}\n\n(Updated from email)`,
          priority,
          assigneeId,
          dueDate: parsedData.deadline || existingTask.dueDate
        });
        
        return { task: updatedTask || null, isNew: false };
      } else {
        // Create a new task
        const newTask: InsertTask = {
          title: parsedData.subject,
          description: parsedData.body,
          status: TaskStatus.TODO,
          priority,
          assigneeId,
          workspaceId: parsedData.workspaceId,
          dueDate: parsedData.deadline || null,
          startDate: new Date(),
          completed: false
        };

        // Save the task to storage
        const createdTask = await storage.createTask(newTask);
        
        // If we have a message ID, store it for future updates
        if (createdTask && parsedData.messageId) {
          this.existingTasksByMessageId.set(parsedData.messageId, createdTask);
        }
        
        return { task: createdTask, isNew: true };
      }
    } catch (error) {
      console.error('Error creating/updating task from email:', error);
      return { task: null, isNew: false };
    }
  }

  /**
   * Process new emails and create/update tasks
   */
  async processEmails(): Promise<{ tasksCreated: number, tasksUpdated: number }> {
    try {
      // Make sure the service is configured
      if (!this.isServiceConfigured()) {
        throw new Error('Email service not configured');
      }
      
      // Fetch unread emails
      const emails = await this.fetchUnreadEmails();
      let tasksCreated = 0;
      let tasksUpdated = 0;

      // Process each email
      for (const email of emails) {
        // Parse the email
        const parsedData = this.parseEmail(email);
        
        if (parsedData) {
          // Create or update a task from the parsed data
          const { task, isNew } = await this.createOrUpdateTaskFromEmail(parsedData);
          
          if (task) {
            if (isNew) {
              tasksCreated++;
            } else {
              tasksUpdated++;
            }
          }
        }
      }

      return { tasksCreated, tasksUpdated };
    } catch (error) {
      console.error('Error processing emails:', error);
      throw error;
    }
  }
  
  /**
   * Get the current configuration (with password masked)
   */
  getConfig(): Partial<EmailConfig> | null {
    if (!this.config) return null;
    
    return {
      emailAddress: this.config.emailAddress,
      imapHost: this.config.imapHost,
      imapPort: this.config.imapPort,
      emailLabel: this.config.emailLabel
    };
  }
}

// Create an instance of the service
export const emailService = new EmailService();