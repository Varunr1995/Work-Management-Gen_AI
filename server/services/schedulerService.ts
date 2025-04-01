import { emailService } from './emailService';

/**
 * Class to handle scheduled jobs
 */
export class SchedulerService {
  private emailCheckInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Start the email checking job
   * @param intervalMinutes How often to check for new emails (in minutes)
   */
  startEmailChecker(intervalMinutes: number = 5): void {
    if (this.emailCheckInterval) {
      console.log('Email checker already running');
      return;
    }

    // Make sure the email service is configured
    if (!emailService.isServiceConfigured()) {
      throw new Error('Email service is not configured. Please configure email settings first.');
    }

    console.log(`Starting email checker service to run every ${intervalMinutes} minutes`);
    
    // Convert minutes to milliseconds
    const intervalMs = intervalMinutes * 60 * 1000;
    
    // Run once immediately
    this.processEmails();
    
    // Set up interval
    this.emailCheckInterval = setInterval(() => {
      this.processEmails();
    }, intervalMs);
  }

  /**
   * Stop the email checking job
   */
  stopEmailChecker(): void {
    if (this.emailCheckInterval) {
      clearInterval(this.emailCheckInterval);
      this.emailCheckInterval = null;
      console.log('Email checker stopped');
    }
  }

  /**
   * Check if the scheduler is currently running
   */
  isSchedulerRunning(): boolean {
    return this.emailCheckInterval !== null;
  }

  /**
   * Process emails and create tasks
   */
  private async processEmails(): Promise<void> {
    // Prevent concurrent runs
    if (this.isRunning) {
      console.log('Email processing already in progress, skipping this run');
      return;
    }

    try {
      this.isRunning = true;
      console.log('Checking for new emails...');
      
      // Process emails using the Email service
      const result = await emailService.processEmails();
      
      if (result.tasksCreated > 0 || result.tasksUpdated > 0) {
        console.log(`Created ${result.tasksCreated} new task(s) and updated ${result.tasksUpdated} task(s) from emails`);
      } else {
        console.log('No new or updated tasks from emails');
      }
    } catch (error) {
      console.error('Error processing emails:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

// Create an instance of the scheduler service
export const schedulerService = new SchedulerService();