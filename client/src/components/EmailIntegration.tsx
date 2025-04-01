import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, Mail, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

interface EmailIntegrationProps {}

export const EmailIntegration = () => {
  const { toast } = useToast();
  const [isSchedulerRunning, setIsSchedulerRunning] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [missingCredentials, setMissingCredentials] = useState<{
    clientId: boolean;
    clientSecret: boolean;
    refreshToken: boolean;
  } | null>(null);

  // Manual check emails mutation
  const checkEmailsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/email/check");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Emails checked",
        description: data.message || "Email check completed",
        variant: "default",
      });
      
      // Update task list after creating tasks from emails
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      
      setIsConfigured(true);
    },
    onError: (error: any) => {
      if (error.response?.status === 400) {
        setIsConfigured(false);
        setMissingCredentials(error.response.data.missingCredentials);
      }
      
      toast({
        title: "Error checking emails",
        description: error.response?.data?.message || "Failed to check emails",
        variant: "destructive",
      });
    },
  });

  // Start scheduler mutation
  const startSchedulerMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/email/scheduler/start", { intervalMinutes });
    },
    onSuccess: (data: any) => {
      setIsSchedulerRunning(true);
      toast({
        title: "Email scheduler started",
        description: data.message || "Email scheduler has been started",
        variant: "default",
      });
      setIsConfigured(true);
    },
    onError: (error: any) => {
      if (error.response?.status === 400) {
        setIsConfigured(false);
        setMissingCredentials(error.response.data.missingCredentials);
      }
      
      toast({
        title: "Error starting scheduler",
        description: error.response?.data?.message || "Failed to start email scheduler",
        variant: "destructive",
      });
    },
  });

  // Stop scheduler mutation
  const stopSchedulerMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/email/scheduler/stop");
    },
    onSuccess: (data: any) => {
      setIsSchedulerRunning(false);
      toast({
        title: "Email scheduler stopped",
        description: data.message || "Email scheduler has been stopped",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error stopping scheduler",
        description: "Failed to stop email scheduler",
        variant: "destructive",
      });
    },
  });

  // Toggle scheduler
  const toggleScheduler = () => {
    if (isSchedulerRunning) {
      stopSchedulerMutation.mutate();
    } else {
      startSchedulerMutation.mutate();
    }
  };

  // Check emails
  const handleCheckEmails = () => {
    checkEmailsMutation.mutate();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Integration
        </CardTitle>
        <CardDescription>
          Automatically create tasks from emails with the 'taskflow' label
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConfigured === false && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Gmail credentials missing</p>
              <p className="text-sm text-amber-700">
                You need to set up the following environment variables:
              </p>
              <ul className="text-xs text-amber-700 mt-1 list-disc pl-4">
                {missingCredentials?.clientId && <li>GMAIL_CLIENT_ID</li>}
                {missingCredentials?.clientSecret && <li>GMAIL_CLIENT_SECRET</li>}
                {missingCredentials?.refreshToken && <li>GMAIL_REFRESH_TOKEN</li>}
              </ul>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="scheduler" className="flex flex-col gap-1">
              <span>Automatic Email Checking</span>
              <span className="font-normal text-xs text-muted-foreground">
                Periodically check for new task emails
              </span>
            </Label>
            <Switch
              id="scheduler"
              checked={isSchedulerRunning}
              onCheckedChange={toggleScheduler}
              disabled={startSchedulerMutation.isPending || stopSchedulerMutation.isPending}
            />
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="interval" className="text-sm">
                Check interval (minutes)
              </Label>
              <Input
                id="interval"
                type="number"
                min={1}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 5)}
                disabled={isSchedulerRunning}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleCheckEmails}
              disabled={checkEmailsMutation.isPending}
              className="flex items-center gap-2"
            >
              {checkEmailsMutation.isPending ? (
                "Checking..."
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Check Now
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        <p>
          Tasks will be created from emails with the "taskflow" label. Include "Assignee:",
          "Priority:", and "Deadline:" in the email body to set those properties.
        </p>
      </CardFooter>
    </Card>
  );
};