import { google } from 'googleapis';
import { simpleParser } from 'mailparser';
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
}

// Class to handle Gmail API operations
export class GmailService {
  private oauth2Client;

  constructor() {
    // Initialize the OAuth2 client with credentials
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    // Set credentials if available
    if (process.env.GMAIL_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });
    }
  }

  /**
   * Fetch unread emails from Gmail
   */
  async fetchUnreadEmails(): Promise<any[]> {
    try {
      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Get list of unread messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread label:taskflow'  // Only get unread emails with the 'taskflow' label
      });

      const messages = response.data.messages || [];
      const emails = [];

      // Fetch each message's full content
      for (const message of messages) {
        const emailData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id || ''
        });

        emails.push(emailData.data);

        // Mark as read after processing
        await gmail.users.messages.modify({
          userId: 'me',
          id: message.id || '',
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        });
      }

      return emails;
    } catch (error) {
      console.error('Error fetching emails:', error);
      return [];
    }
  }

  /**
   * Parse an email to extract task information
   */
  async parseEmail(email: any): Promise<ParsedEmailData | null> {
    try {
      // Get email parts
      const parts = email.payload.parts || [email.payload];
      let emailBody = '';

      // Extract the email body
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          const bodyData = part.body.data;
          const decodedBody = Buffer.from(bodyData, 'base64').toString('utf-8');
          emailBody += decodedBody;
        }
      }

      // Get headers
      const headers = email.payload.headers || [];
      const subject = headers.find((header: any) => header.name === 'Subject')?.value || 'No Subject';

      // Parse the email body for task details
      const parsedData: ParsedEmailData = {
        subject,
        body: emailBody,
        workspaceId: 1  // Default workspace ID
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
        parsedData.deadline = new Date(deadlineMatch[1].trim());
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
   * Create a task from parsed email data
   */
  async createTaskFromEmail(parsedData: ParsedEmailData): Promise<Task | null> {
    try {
      // Find assignee ID based on name if available
      let assigneeId: number | undefined = undefined;
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

      // Create task object
      const newTask: InsertTask = {
        title: parsedData.subject,
        description: parsedData.body,
        status: TaskStatus.TODO,
        priority,
        assigneeId,
        workspaceId: parsedData.workspaceId,
        dueDate: parsedData.deadline,
        startDate: new Date(),
        completed: false
      };

      // Save the task to storage
      return await storage.createTask(newTask);
    } catch (error) {
      console.error('Error creating task from email:', error);
      return null;
    }
  }

  /**
   * Process new emails and create tasks
   */
  async processEmails(): Promise<Task[]> {
    try {
      // Fetch unread emails
      const emails = await this.fetchUnreadEmails();
      const createdTasks: Task[] = [];

      // Process each email
      for (const email of emails) {
        // Parse the email
        const parsedData = await this.parseEmail(email);
        
        if (parsedData) {
          // Create a task from the parsed data
          const task = await this.createTaskFromEmail(parsedData);
          if (task) {
            createdTasks.push(task);
          }
        }
      }

      return createdTasks;
    } catch (error) {
      console.error('Error processing emails:', error);
      return [];
    }
  }
}

// Create an instance of the service
export const gmailService = new GmailService();