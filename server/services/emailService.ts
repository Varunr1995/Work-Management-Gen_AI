import Imap from 'node-imap';
import { simpleParser } from 'mailparser';

// Fix for ParsedMail typing issues
type ParsedMail = {
  text?: string;
  subject?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
};
import { Task, TaskPriority, TaskStatus, TaskType, InsertTask, InsertNotification } from '@shared/schema';
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
  inReplyTo?: string;
  references?: string[];
  taskType?: 'sprint' | 'adhoc';
  originalSubject?: string;
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
    const emailPassword = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD;
    if (process.env.EMAIL_ADDRESS && emailPassword) {
      console.log('Loading email configuration from environment variables');
      this.config = {
        emailAddress: process.env.EMAIL_ADDRESS,
        emailPassword: emailPassword,
        imapHost: process.env.IMAP_HOST || 'imap.gmail.com',
        imapPort: process.env.IMAP_PORT ? parseInt(process.env.IMAP_PORT) : 993,
        emailLabel: process.env.EMAIL_LABEL || 'INBOX'
      };
      this.isConfigured = true;
      this.initializeImap();
      console.log('Email service configured from environment variables');
    }
  }

  /**
   * Configure the email service with user-provided settings
   * @returns Promise that resolves to true if connection test was successful
   */
  async configure(config: EmailConfig): Promise<boolean> {
    this.config = config;
    this.isConfigured = true;
    this.initializeImap();
    
    // Test the connection
    try {
      console.log('Testing IMAP connection...');
      
      // Create a new IMAP instance for testing
      const testImap = new Imap({
        user: config.emailAddress,
        password: config.emailPassword,
        host: config.imapHost,
        port: config.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000 // 10 second connection timeout for testing
      });
      
      // Test the connection by connecting
      await new Promise<void>((resolve, reject) => {
        testImap.once('ready', () => {
          console.log('Test IMAP connection successful');
          testImap.end();
          resolve();
        });
        
        testImap.once('error', (err) => {
          console.error('Test IMAP connection failed:', err);
          reject(err);
        });
        
        testImap.connect();
      });
      
      return true;
    } catch (error) {
      console.error('Email configuration test failed:', error);
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Check if the service is configured
   */
  isServiceConfigured(): boolean {
    const result = this.isConfigured && this.config !== null;
    console.log('isServiceConfigured called:', { 
      result,
      isConfigured: this.isConfigured,
      hasConfig: this.config !== null,
      configDetails: this.config ? {
        emailAddress: this.config.emailAddress,
        hasPassword: !!this.config.emailPassword,
        label: this.config.emailLabel
      } : 'No config'
    });
    return result;
  }

  /**
   * Initialize IMAP connection with current config
   */
  private initializeImap(): void {
    if (!this.config) {
      console.log('Cannot initialize IMAP: No configuration available');
      return;
    }
    
    console.log('Initializing IMAP connection with:', {
      user: this.config.emailAddress,
      host: this.config.imapHost,
      port: this.config.imapPort,
      hasPassword: !!this.config.emailPassword
    });
    
    try {
      this.imap = new Imap({
        user: this.config.emailAddress,
        password: this.config.emailPassword,
        host: this.config.imapHost,
        port: this.config.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
      });
      
      // Add event listeners for debugging
      this.imap.on('error', (err: any) => {
        console.error('IMAP connection error:', err);
        // If there's a persistent connection error, mark as not configured
        if (err.source === 'timeout' || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
          console.error('Critical IMAP error, marking service as not configured');
          this.isConfigured = false;
        }
      });
      
      this.imap.on('end', () => {
        console.log('IMAP connection ended');
      });
      
      this.imap.on('ready', () => {
        console.log('IMAP connection ready');
      });
      
      console.log('IMAP connection object created successfully');
    } catch (error) {
      console.error('Error creating IMAP connection:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Fetch unread emails from the configured account
   */
  async fetchUnreadEmails(): Promise<ParsedMail[]> {
    console.log('Attempting to fetch unread emails');
    
    if (!this.isServiceConfigured() || !this.imap) {
      console.error('Cannot fetch emails: Email service not configured or IMAP client missing');
      throw new Error('Email service not configured. Please configure the service first.');
    }

    return new Promise((resolve, reject) => {
      const emails: ParsedMail[] = [];
      const processedUIDs: number[] = [];
      
      console.log('Setting up IMAP connection for email fetch');
    
      this.imap!.once('ready', () => {
        console.log('IMAP connection ready, opening mailbox:', this.config!.emailLabel);
        
        this.imap!.openBox(this.config!.emailLabel, false, (err, box) => {
          if (err) {
            console.error('Error opening mailbox:', err);
            this.imap!.end();
            return reject(err);
          }
          
          console.log('Mailbox opened successfully:', box?.name);
          
          // Search for unread messages
          console.log('Searching for unread messages');
          this.imap!.search(['UNSEEN'], (err, results) => {
            if (err) {
              console.error('Error searching emails:', err);
              this.imap!.end();
              return reject(err);
            }
            
            console.log(`Found ${results.length} unread messages`);
            
            if (results.length === 0) {
              this.imap!.end();
              return resolve([]);
            }
            
            console.log('Fetching message bodies');
            const f = this.imap!.fetch(results, { 
              bodies: '',
              markSeen: true 
            });
            
            f.on('message', (msg, seqno) => {
              console.log(`Processing message #${seqno}`);
              let uid: number;
              
              msg.once('attributes', (attrs) => {
                uid = attrs.uid;
                processedUIDs.push(uid);
                console.log(`Message UID: ${uid}`);
              });
              
              msg.on('body', (stream, info) => {
                console.log('Receiving message body');
                let buffer = '';
                
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                
                stream.once('end', async () => {
                  try {
                    console.log(`Parsing email body of length ${buffer.length}`);
                    const parsedEmail = await simpleParser(buffer);
                    console.log(`Successfully parsed email: "${parsedEmail.subject}"`);
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
              console.log('Finished fetching all messages');
              this.imap!.end();
              console.log(`Successfully fetched ${emails.length} emails`);
              resolve(emails);
            });
          });
        });
      });
      
      this.imap!.once('error', (err) => {
        console.error('IMAP error during fetch:', err);
        reject(err);
      });
      
      console.log('Initiating IMAP connection');
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
      const inReplyTo = email.inReplyTo;
      const references = email.references || [];

      console.log(`Attempting to parse email: "${subject}"`);

      // Detect if this is a reply email
      const isReplyEmail = subject.startsWith('Re:') || subject.startsWith('RE:') || !!inReplyTo;
      let originalSubject = subject;
      
      // Remove the 'Re:' prefix if it exists
      if (isReplyEmail && (subject.startsWith('Re:') || subject.startsWith('RE:'))) {
        originalSubject = subject.replace(/^Re:\s*/i, '').trim();
      }

      // Parse the email body for task details
      const parsedData: ParsedEmailData = {
        subject,
        body: emailBody,
        workspaceId: 1,  // Default workspace ID
        messageId,
        inReplyTo,
        references,
        originalSubject: isReplyEmail ? originalSubject : undefined
      };

      // Try to extract information from formatted tags first
      
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
      const deadlineMatch = emailBody.match(/Deadline:\s*([^\n]+)/i) || 
                            emailBody.match(/Due(?: Date)?:\s*([^\n]+)/i) ||
                            emailBody.match(/by:?\s*([^\n,:;]+)/i);
                            
      if (deadlineMatch && deadlineMatch[1]) {
        const deadlineStr = deadlineMatch[1].trim();
        const deadlineDate = new Date(deadlineStr);
        
        // Check if the date is valid
        if (!isNaN(deadlineDate.getTime())) {
          parsedData.deadline = deadlineDate;
          console.log(`Found deadline: ${deadlineDate}`);
        }
      }

      // Extract priority
      const priorityMatch = emailBody.match(/Priority:\s*(high|medium|low)/i) ||
                            emailBody.match(/\b(high|medium|low) priority\b/i) ||
                            emailBody.match(/\b(urgent|important)\b/i);
                            
      if (priorityMatch) {
        let priority = priorityMatch[1].toLowerCase();
        
        // Map 'urgent' and 'important' to high priority
        if (priority === 'urgent' || priority === 'important') {
          priority = 'high';
        }
        
        parsedData.priority = priority;
        console.log(`Found priority: ${priority}`);
      }

      // Extract task type (Sprint/AdHoc)
      const taskTypeMatch = emailBody.match(/Task Type:\s*(sprint|adhoc)/i) ||
                          emailBody.match(/\b(sprint|adhoc) task\b/i);

      if (taskTypeMatch) {
        const taskType = taskTypeMatch[1].toLowerCase() as 'sprint' | 'adhoc';
        parsedData.taskType = taskType;
        console.log(`Found task type: ${taskType}`);
      } else {
        // Default to AdHoc if not specified
        parsedData.taskType = 'adhoc';
      }
      
      // Clean up the email body by removing all parsed metadata
      let cleanBody = emailBody;
      
      // Remove all metadata lines
      if (assigneeMatch) {
        cleanBody = cleanBody.replace(/Assignee:\s*([^\n]+)/i, '');
      }
      
      if (priorityMatch) {
        cleanBody = cleanBody.replace(/Priority:\s*(high|medium|low)/i, '');
        cleanBody = cleanBody.replace(/\b(high|medium|low) priority\b/i, '');
      }
      
      if (deadlineMatch) {
        cleanBody = cleanBody.replace(/Deadline:\s*([^\n]+)/i, '');
        cleanBody = cleanBody.replace(/Due(?: Date)?:\s*([^\n]+)/i, '');
        cleanBody = cleanBody.replace(/by:?\s*([^\n,:;]+)/i, '');
      }
      
      if (taskTypeMatch) {
        cleanBody = cleanBody.replace(/Task Type:\s*(sprint|adhoc)/i, '');
        cleanBody = cleanBody.replace(/\b(sprint|adhoc) task\b/i, '');
      }
      
      if (teamMatch) {
        cleanBody = cleanBody.replace(/Team:\s*([^\n]+)/i, '');
      }
      
      // Remove lines with just dashes or bullet points
      cleanBody = cleanBody.replace(/^\s*[-•*]\s*$/gm, '');
      
      // Clean up multiple empty lines
      cleanBody = cleanBody.replace(/\n{3,}/g, '\n\n');
      
      // Trim any leading/trailing whitespace
      cleanBody = cleanBody.trim();
      
      // Update the parsed data with clean body
      parsedData.body = cleanBody;

      // If the subject line contains certain keywords, auto-assign higher priority
      const urgentSubject = /(urgent|asap|immediately|deadline|due|important)/i.test(subject);
      if (urgentSubject && !parsedData.priority) {
        parsedData.priority = 'high';
        console.log('Subject indicates high priority');
      }

      // For short emails or emails from specific domains, they're more likely to be task requests
      const isLikelyTask = subject.length < 150 && 
                          (emailBody.length < 1000 || 
                          /action|task|follow up|update|review|check|complete/i.test(subject));
                          
      if (isLikelyTask) {
        console.log(`Email "${subject}" looks like a task`);
        return parsedData;
      } else if (parsedData.priority === 'high' || parsedData.deadline) {
        // If we found priority or deadline information, it's likely a task
        console.log(`Email has task-like attributes (priority/deadline)`);
        return parsedData;
      } else if (/\b(task|todo|action item|follow up|please|update|review|complete)\b/i.test(emailBody.substring(0, 500))) {
        // Check if the beginning of the email has task-like wording
        console.log(`Email contains task-like language in the beginning`);
        return parsedData;
      }
      
      // If we couldn't determine if this is a task, return null
      console.log(`Email doesn't appear to be a task request: ${subject}`);
      return null;
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
      let parentTaskId: number | null = null;
      
      if (parsedData.messageId) {
        // In a real implementation, we would look up tasks by message ID in a database
        // For this implementation, we'll simulate this with our in-memory map
        existingTask = this.existingTasksByMessageId.get(parsedData.messageId);
        
        if (existingTask) {
          isNewTask = false;
        }
      }

      // Check if this is a reply email and find the parent task
      const isReplyEmail = parsedData.subject.startsWith('Re:') || parsedData.subject.startsWith('RE:') || !!parsedData.inReplyTo;
      
      if (isReplyEmail) {
        // Multiple strategies to find parent task
        
        // 1. First try to use inReplyTo if available
        if (parsedData.inReplyTo) {
          console.log(`Searching for parent task using inReplyTo: ${parsedData.inReplyTo}`);
          const allTasks = await storage.getTasks(parsedData.workspaceId);
          const parentTaskByMessageId = allTasks.find(task => 
            task.emailThreadId === parsedData.inReplyTo
          );
          
          if (parentTaskByMessageId) {
            console.log(`Found parent task using inReplyTo, task ID: ${parentTaskByMessageId.id}`);
            parentTaskId = parentTaskByMessageId.id;
          }
        }
        
        // 2. If we couldn't find by message ID, try by subject
        if (!parentTaskId && parsedData.originalSubject) {
          console.log(`Looking for original task with subject: ${parsedData.originalSubject}`);
          
          // Get all tasks and find one with matching title
          const allTasks = await storage.getTasks(parsedData.workspaceId);
          const parentTask = allTasks.find(task => 
            task.title.toLowerCase() === parsedData.originalSubject?.toLowerCase()
          );
          
          if (parentTask) {
            console.log(`Found parent task by subject, task ID: ${parentTask.id}`);
            parentTaskId = parentTask.id;
          }
        }
        
        // 3. If still not found, try looking for the most recent task with a title contained in the email body
        if (!parentTaskId) {
          console.log('Trying to find parent task from quoted text in email body');
          
          // Look for quoted text in the email body that might be a task title
          const quotedTextMatch = parsedData.body.match(/^>([^\n]+)/m);
          if (quotedTextMatch && quotedTextMatch[1]) {
            const quotedText = quotedTextMatch[1].trim();
            
            // If there's a quoted text, check if any task title contains it
            const allTasks = await storage.getTasks(parsedData.workspaceId);
            
            // Sort by start date (descending) so we get the most recent one first
            const sortedTasks = allTasks.sort((a, b) => {
              if (a.startDate && b.startDate) {
                return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
              }
              return 0;
            });
            
            const parentTaskByQuote = sortedTasks.find(task => quotedText.includes(task.title));
            
            if (parentTaskByQuote) {
              console.log(`Found parent task by quoted text, task ID: ${parentTaskByQuote.id}`);
              parentTaskId = parentTaskByQuote.id;
            }
          }
        }
        
        if (parentTaskId) {
          console.log(`Successfully identified parent task ID: ${parentTaskId}`);
        } else {
          console.log('Could not find parent task for this reply email');
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

      // Determine task type
      const taskType = parsedData.taskType || TaskType.ADHOC;

      // If we're updating an existing task
      if (!isNewTask && existingTask) {
        const updatedTask = await storage.updateTask(existingTask.id, {
          title: parsedData.subject,
          description: `${parsedData.body}\n\n(Updated from email)`,
          priority,
          assigneeId,
          dueDate: parsedData.deadline || existingTask.dueDate,
          taskType
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
          completed: false,
          taskType,
          parentTaskId,
          emailThreadId: parsedData.messageId
        };

        // Save the task to storage
        const createdTask = await storage.createTask(newTask);
        
        // If we have a message ID, store it for future updates
        if (createdTask && parsedData.messageId) {
          this.existingTasksByMessageId.set(parsedData.messageId, createdTask);
        }

        // Create a notification for admins about the new task
        if (createdTask) {
          try {
            // Find admin users
            const users = await storage.getUsers();
            const adminUsers = users.filter(user => user.role === 'admin');

            // Create notification for each admin
            for (const admin of adminUsers) {
              const notification: InsertNotification = {
                userId: admin.id,
                taskId: createdTask.id,
                title: 'New Task Created',
                message: `A new ${taskType} task "${createdTask.title}" has been created from an email.`,
                type: 'task_created'
              };
              
              await storage.createNotification(notification);
            }
          } catch (err) {
            console.error('Error creating admin notifications:', err);
          }
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