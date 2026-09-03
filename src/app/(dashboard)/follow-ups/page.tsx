"use client";

import { useState } from 'react';
import { useDemoState } from '@/hooks/use-demo-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCcw, Send, CheckCircle2, Clock, Phone, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FollowUpsPage() {
  const { appointments } = useDemoState();
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const defaultTasks = [
    { id: "f-1", patient_name: "Rahul Sharma", phone_number: "+91 98765 43210", reason: "Post-consultation BP & ECG check-in", due: "Today (in 2 hrs)", priority: "High", department: "Cardiology" },
    { id: "f-2", patient_name: "Priya Patel", phone_number: "+91 98123 45678", reason: "Vaccination schedule confirmation (DTP Booster)", due: "Today", priority: "Medium", department: "Pediatrics" },
    { id: "f-3", patient_name: "Amit Kumar Verma", phone_number: "+91 97234 56789", reason: "Fasting Blood Sugar report review", due: "Tomorrow", priority: "Low", department: "General" },
  ];

  const toggleComplete = (id: string) => {
    setCompletedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <RefreshCcw className="h-6 w-6 text-primary" />
            Clinical Follow-Ups
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Automated WhatsApp reminders and clinic tasks to track patient recovery and care compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 border-primary/30 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Auto-trigger All Due WhatsApp Reminders
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold text-muted-foreground">Patient</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Contact</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Follow-Up Goal</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Due Timeline</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Priority</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {defaultTasks.map((task) => {
              const isDone = completedIds.includes(task.id);
              return (
                <TableRow key={task.id} className={`border-border hover:bg-muted/40 transition-colors ${isDone ? 'opacity-50 bg-muted/20' : ''}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {task.patient_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold text-foreground ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                          {task.patient_name}
                        </p>
                        <p className="text-[10px] text-primary font-medium">{task.department}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {task.phone_number}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-foreground max-w-xs">
                    {task.reason}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 text-primary" />
                      {task.due}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      task.priority === 'High' 
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' 
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}>
                      {task.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-xs gap-1"
                        disabled={isDone}
                      >
                        <Send className="h-3 w-3 text-emerald-600" />
                        Send Reminder
                      </Button>
                      <Button 
                        size="sm" 
                        variant={isDone ? "ghost" : "default"}
                        className={`h-8 text-xs ${isDone ? 'text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
                        onClick={() => toggleComplete(task.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {isDone ? 'Completed' : 'Mark Done'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
