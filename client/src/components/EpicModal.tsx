import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Task, TaskPriority, TaskStatus, TaskType, User } from "@shared/schema";

interface EpicModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  workspaceId: number;
  editEpic?: Task | null;
}

// Epic form validation schema
const epicSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string(),
  priority: z.string(),
  assigneeId: z.number().optional().nullable(),
  startDate: z.date().optional().nullable(),
  dueDate: z.date().optional().nullable(),
  workspaceId: z.number(),
});

type EpicFormValues = z.infer<typeof epicSchema>;

export function EpicModal({ isOpen, onClose, users, workspaceId, editEpic }: EpicModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create form with default values
  const form = useForm<EpicFormValues>({
    resolver: zodResolver(epicSchema),
    defaultValues: {
      title: editEpic?.title || "",
      description: editEpic?.description || "",
      status: editEpic?.status || TaskStatus.TODO,
      priority: editEpic?.priority || TaskPriority.MEDIUM,
      assigneeId: editEpic?.assigneeId || null,
      startDate: editEpic?.startDate ? new Date(editEpic.startDate) : null,
      dueDate: editEpic?.dueDate ? new Date(editEpic.dueDate) : null,
      workspaceId: workspaceId,
    },
  });

  // Create mutation for creating a new epic
  const createEpicMutation = useMutation({
    mutationFn: async (data: EpicFormValues) => {
      // Add the epic task type to the data
      const epicData = {
        ...data,
        taskType: TaskType.EPIC,
      };
      console.log("Submitting epic data:", epicData);
      try {
        // Fixed order: url, method, data
        const response = await apiRequest("/api/tasks", "POST", epicData);
        console.log("Epic creation response:", response);
        return response;
      } catch (error) {
        console.error("Error in API request:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Epic created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "tasks"] });
      toast({
        title: "Epic created",
        description: "The epic was created successfully.",
      });
      form.reset();
      onClose();
    },
    onError: (error) => {
      console.error("Error creating epic:", error);
      toast({
        title: "Error",
        description: "Failed to create epic. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create mutation for updating an epic
  const updateEpicMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: EpicFormValues }) => {
      console.log("Updating epic with data:", data);
      const response = await apiRequest(`/api/tasks/${id}`, "PATCH", data);
      console.log("Epic update response:", response);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "tasks"] });
      toast({
        title: "Epic updated",
        description: "The epic was updated successfully.",
      });
      onClose();
    },
    onError: (error) => {
      console.error("Error updating epic:", error);
      toast({
        title: "Error",
        description: "Failed to update epic. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: EpicFormValues) => {
    if (editEpic) {
      updateEpicMutation.mutate({ id: editEpic.id, data });
    } else {
      createEpicMutation.mutate(data);
    }
  };

  // Generate documentation for completed epics
  const generateDocumentationMutation = useMutation({
    mutationFn: async (epicId: number) => {
      console.log("Generating documentation for epic ID:", epicId);
      return apiRequest(`/api/epics/${epicId}/generate-documentation`, "POST", null);
    },
    onSuccess: (data) => {
      toast({
        title: "Documentation Generated",
        description: "Epic documentation has been generated successfully.",
      });
      console.log("Generated documentation:", data.documentation);
    },
    onError: (error) => {
      console.error("Error generating documentation:", error);
      toast({
        title: "Error",
        description: "Failed to generate epic documentation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // When the status is changed to completed and it's an existing epic, 
  // offer to generate documentation
  const handleStatusChange = (status: string) => {
    form.setValue("status", status);
    
    // If the epic is being marked as completed and it's an edit (not a new epic)
    if (status === TaskStatus.COMPLETED && editEpic) {
      toast({
        title: "Epic Completed",
        description: "Would you like to generate documentation for this epic?",
        action: (
          <Button variant="default" onClick={() => generateDocumentationMutation.mutate(editEpic.id)}>
            Generate
          </Button>
        ),
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editEpic ? "Edit Epic" : "Create Epic"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Epic title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Epic description"
                      className="resize-none min-h-[100px]"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Status Field */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={(value) => handleStatusChange(value)}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={TaskStatus.TODO}>To Do</SelectItem>
                        <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                        <SelectItem value={TaskStatus.IN_REVIEW}>In Review</SelectItem>
                        <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority Field */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
                        <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
                        <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Assignee Field */}
              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "0" ? null : parseInt(value))}
                      defaultValue={field.value?.toString() || "0"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Unassigned</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Start Date Field */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={(date) => field.onChange(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date Field */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={(date) => field.onChange(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={createEpicMutation.isPending || updateEpicMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createEpicMutation.isPending || updateEpicMutation.isPending}
              >
                {createEpicMutation.isPending || updateEpicMutation.isPending ? (
                  "Saving..."
                ) : (
                  editEpic ? "Update Epic" : "Create Epic"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}