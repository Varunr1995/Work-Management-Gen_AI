import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, Mail, AlertTriangle, Lock, Plus, Settings, Save, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface EmailConfigType {
  emailAddress: string;
  emailPassword: string;
  imapHost: string;
  imapPort: number;
  emailLabel: string;
}

interface EmailIntegrationProps {}

export const EmailIntegration = () => {
  const { toast } = useToast();
  const [isSchedulerRunning, setIsSchedulerRunning] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isShowingPassword, setIsShowingPassword] = useState(false);
  const [showingAdvanced, setShowingAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Email configuration
  const [emailConfig, setEmailConfig] = useState<EmailConfigType>({
    emailAddress: "",
    emailPassword: "",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    emailLabel: "INBOX"
  });

  const handleConfigChange = (field: keyof EmailConfigType, value: string | number) => {
    setEmailConfig({
      ...emailConfig,
      [field]: value
    });
  };

  // Configure email mutation
  const configureEmailMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/email/configure", emailConfig);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Email configured",
        description: "Your email settings have been saved",
        variant: "default",
      });
      setIsConfigured(true);
      setActiveTab("overview");
    },
    onError: (error: any) => {
      toast({
        title: "Configuration error",
        description: error.response?.data?.message || "Failed to configure email",
        variant: "destructive",
      });
    },
  });

  // Manual check emails mutation
  const checkEmailsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/email/check");
    },
    onSuccess: (data: any) => {
      const createdCount = data.tasksCreated || 0;
      const updatedCount = data.tasksUpdated || 0;
      
      toast({
        title: "Emails processed",
        description: `Created ${createdCount} new tasks and updated ${updatedCount} existing tasks`,
        variant: "default",
      });
      
      // Update task list after creating tasks from emails
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      
      setIsConfigured(true);
    },
    onError: (error: any) => {
      if (error.response?.status === 400) {
        setIsConfigured(false);
        setActiveTab("settings");
      }
      
      toast({
        title: "Error checking emails",
        description: error.response?.data?.message || "Failed to check emails. Please configure email settings.",
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
        description: `Checking emails every ${intervalMinutes} minutes`,
        variant: "default",
      });
      setIsConfigured(true);
    },
    onError: (error: any) => {
      if (error.response?.status === 400) {
        setIsConfigured(false);
        setActiveTab("settings");
      }
      
      toast({
        title: "Error starting scheduler",
        description: error.response?.data?.message || "Failed to start email scheduler. Please configure email settings.",
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
        description: "Automatic email checking has been stopped",
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

  // Save email configuration
  const handleSaveConfig = () => {
    configureEmailMutation.mutate();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Integration
        </CardTitle>
        <CardDescription>
          Automatically create tasks from emails in your inbox
        </CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mx-6">
          <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
        </TabsList>
        
        <CardContent className="pt-4">
          <TabsContent value="overview" className="m-0">
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
              
              {isConfigured === false && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Email not configured</p>
                    <p className="text-sm text-amber-700">
                      Please go to the Settings tab to configure your email connection.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="m-0 space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="your.email@gmail.com"
                  value={emailConfig.emailAddress}
                  onChange={(e) => handleConfigChange('emailAddress', e.target.value)}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="password">Password/App Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={isShowingPassword ? "text" : "password"} 
                    placeholder="Your app password"
                    value={emailConfig.emailPassword}
                    onChange={(e) => handleConfigChange('emailPassword', e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setIsShowingPassword(!isShowingPassword)}
                  >
                    {isShowingPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  For Gmail, use an app password generated in your Google Account settings.
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="label">Email Label/Folder</Label>
                <Input 
                  id="label" 
                  placeholder="INBOX"
                  value={emailConfig.emailLabel}
                  onChange={(e) => handleConfigChange('emailLabel', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Only emails with this label will be processed for task creation
                </p>
              </div>
              
              <Accordion
                type="single"
                collapsible
                value={showingAdvanced ? "advanced" : ""}
                onValueChange={(val) => setShowingAdvanced(val === "advanced")}
              >
                <AccordionItem value="advanced">
                  <AccordionTrigger className="text-sm">Advanced Settings</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="grid gap-2">
                      <Label htmlFor="imapHost">IMAP Server</Label>
                      <Input 
                        id="imapHost" 
                        placeholder="imap.gmail.com"
                        value={emailConfig.imapHost}
                        onChange={(e) => handleConfigChange('imapHost', e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="imapPort">IMAP Port</Label>
                      <Input 
                        id="imapPort" 
                        type="number"
                        placeholder="993"
                        value={emailConfig.imapPort}
                        onChange={(e) => handleConfigChange('imapPort', parseInt(e.target.value) || 993)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            
            <Button 
              className="w-full mt-4 flex items-center gap-2"
              onClick={handleSaveConfig}
              disabled={configureEmailMutation.isPending || !emailConfig.emailAddress || !emailConfig.emailPassword}
            >
              {configureEmailMutation.isPending ? (
                "Saving..."
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Email Configuration
                </>
              )}
            </Button>
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="text-xs text-muted-foreground flex flex-col">
        <p className="text-left w-full">
          Tasks will be created from emails in the specified label. Include keywords in the email body:
        </p>
        <ul className="list-disc pl-4 mt-1 space-y-0.5">
          <li>Assignee: [name] - Assign task to team member</li>
          <li>Priority: [high/medium/low] - Set task priority</li>
          <li>Deadline: [date] - Set due date</li>
        </ul>
      </CardFooter>
    </Card>
  );
};