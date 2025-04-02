import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, CheckCircle2, Send, RefreshCcw, Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SlackConfigType {
  botToken: string;
  channelId: string;
}

interface SlackIntegrationProps {}

export const SlackIntegration: React.FC<SlackIntegrationProps> = () => {
  const { toast } = useToast();
  const [configOpen, setConfigOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [slackConfig, setSlackConfig] = useState<SlackConfigType>({
    botToken: "",
    channelId: "",
  });
  const [configStatus, setConfigStatus] = useState<{
    isConfigured: boolean;
    config: Partial<SlackConfigType> | null;
  }>({
    isConfigured: false,
    config: null,
  });
  const [slackMessage, setSlackMessage] = useState("");
  
  // Loading states
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<{
    success: boolean;
    message: string;
    tasksCreated?: number;
    duplicatesDetected?: number;
  } | null>(null);
  const [lastSendResult, setLastSendResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
  } | null>(null);

  // Initialize on component mount
  useEffect(() => {
    // Try to check if already configured
    checkConfigStatus().catch(() => {
      // Silently fail - this means the service is not configured
      console.log('Slack service not yet configured');
    });
  }, []);

  // Check configuration status on component mount
  const checkConfigStatus = async () => {
    try {
      const res = await apiRequest("POST", "/slack/check");
      
      // If we get a 400, it means the service is not configured
      setConfigStatus({
        isConfigured: true,
        config: res.config || null,
      });
      
      return true;
    } catch (error) {
      // Not configured yet
      setConfigStatus({
        isConfigured: false,
        config: null,
      });
      
      return false;
    }
  };
  
  const saveConfig = async () => {
    if (!slackConfig.botToken || !slackConfig.channelId) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    setIsConfiguring(true);
    
    try {
      const response = await apiRequest("POST", "/slack/configure", slackConfig);
      
      if (response.success) {
        setConfigStatus({
          isConfigured: true,
          config: response.config,
        });
        
        toast({
          title: "Configuration saved",
          description: response.message,
        });
        
        setConfigOpen(false);
      } else {
        toast({
          title: "Configuration failed",
          description: response.message || "Could not save Slack configuration",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Configuration failed",
        description: error.message || "Could not save Slack configuration",
        variant: "destructive",
      });
    } finally {
      setIsConfiguring(false);
    }
  };
  
  const checkSlackMessages = async () => {
    setIsChecking(true);
    setLastCheckResult(null);
    
    try {
      const response = await apiRequest("POST", "/slack/check");
      
      setLastCheckResult({
        success: true,
        message: response.message,
        tasksCreated: response.tasksCreated,
        duplicatesDetected: response.duplicatesDetected,
      });
      
      toast({
        title: "Slack check complete",
        description: response.message,
      });
    } catch (error: any) {
      setLastCheckResult({
        success: false,
        message: error.message || "Error checking Slack messages",
      });
      
      toast({
        title: "Slack check failed",
        description: error.message || "Error checking Slack messages",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  const sendSlackMessage = async () => {
    if (!slackMessage) {
      toast({
        title: "Message required",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return;
    }
    
    setIsSending(true);
    setLastSendResult(null);
    
    try {
      const response = await apiRequest("POST", "/slack/send", { message: slackMessage });
      
      setLastSendResult({
        success: true,
        message: response.message,
        messageId: response.messageId,
      });
      
      toast({
        title: "Message sent",
        description: "Message was sent to Slack successfully",
      });
      
      setSendOpen(false);
      setSlackMessage("");
    } catch (error: any) {
      setLastSendResult({
        success: false,
        message: error.message || "Error sending Slack message",
      });
      
      toast({
        title: "Send failed",
        description: error.message || "Error sending Slack message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <svg
              className="h-5 w-5 mr-2"
              fill="#4A154B"
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
            Slack Integration
          </CardTitle>
          <CardDescription>
            Connect to Slack to create tasks from messages and send updates to your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configStatus.isConfigured ? (
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4 border border-green-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Slack Connected</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        Connected to channel: <span className="font-semibold">{configStatus.config?.channelId}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {lastCheckResult && (
                <Alert
                  variant={lastCheckResult.success ? "default" : "destructive"}
                  className={lastCheckResult.success ? "bg-green-50 border-green-200" : ""}
                >
                  <div className="flex items-start">
                    {lastCheckResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                    )}
                    <div>
                      <AlertTitle>{lastCheckResult.success ? "Success" : "Error"}</AlertTitle>
                      <AlertDescription>
                        {lastCheckResult.message}
                        {lastCheckResult.success && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <div>Tasks created: {lastCheckResult.tasksCreated}</div>
                            <div>Duplicates detected: {lastCheckResult.duplicatesDetected}</div>
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}

              {lastSendResult && (
                <Alert
                  variant={lastSendResult.success ? "default" : "destructive"}
                  className={lastSendResult.success ? "bg-green-50 border-green-200" : ""}
                >
                  <div className="flex items-start">
                    {lastSendResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                    )}
                    <div>
                      <AlertTitle>{lastSendResult.success ? "Success" : "Error"}</AlertTitle>
                      <AlertDescription>
                        {lastSendResult.message}
                        {lastSendResult.messageId && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Message ID: {lastSendResult.messageId}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}
            </div>
          ) : (
            <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Slack Not Configured</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>Click the button below to configure your Slack integration.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            onClick={() => setConfigOpen(true)}
            variant="outline"
            className="flex-shrink-0"
            size="sm"
          >
            {configStatus.isConfigured ? "Update Configuration" : "Configure Slack"}
          </Button>
          
          {configStatus.isConfigured && (
            <>
              <Button
                onClick={checkSlackMessages}
                disabled={isChecking}
                variant="secondary"
                className="flex-shrink-0"
                size="sm"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Check Messages
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => setSendOpen(true)}
                className="flex-shrink-0"
                size="sm"
              >
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </>
          )}
        </CardFooter>
      </Card>

      {/* Configure Slack Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Slack Integration</DialogTitle>
            <DialogDescription>
              Enter your Slack Bot Token and Channel ID to connect to Slack.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bot-token">Slack Bot Token <span className="text-red-500">*</span></Label>
              <Input
                id="bot-token"
                type="password"
                value={slackConfig.botToken}
                onChange={(e) => setSlackConfig({...slackConfig, botToken: e.target.value})}
                placeholder="xoxb-your-bot-token"
              />
              <p className="text-xs text-muted-foreground">
                Your Slack Bot Token starts with "xoxb-". This can be found in your Slack App settings.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="channel-id">Channel ID <span className="text-red-500">*</span></Label>
              <Input
                id="channel-id"
                value={slackConfig.channelId}
                onChange={(e) => setSlackConfig({...slackConfig, channelId: e.target.value})}
                placeholder="C0123456789"
              />
              <p className="text-xs text-muted-foreground">
                The ID of the Slack channel (e.g., C0123456789). Right-click the channel in Slack and select "Copy Link" to get this.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={isConfiguring}>
              {isConfiguring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Message to Slack</DialogTitle>
            <DialogDescription>
              Enter a message to send to your configured Slack channel.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={slackMessage}
                onChange={(e) => setSlackMessage(e.target.value)}
                placeholder="Enter your message here..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendSlackMessage} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};