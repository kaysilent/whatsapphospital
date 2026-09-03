"use client";

import React from 'react';
import { useDemoState } from '@/hooks/use-demo-state';

export function AiAgentPanel() {
  const { systemPrompt, setSystemPrompt, isCalendarConnected, setIsCalendarConnected } = useDemoState();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">AI Agent Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure the behavior and integrations for your conversational AI agent.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h4 className="text-base font-semibold text-card-foreground">System Prompt</h4>
        <p className="text-sm text-muted-foreground">
          Change how the AI behaves. The AI will adopt this persona instantly in the chat emulator.
        </p>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
        />
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h4 className="text-base font-semibold text-card-foreground">Google Calendar Integration</h4>
        <p className="text-sm text-muted-foreground">
          Connect your calendar to automatically check availability and sync bookings from the AI.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsCalendarConnected(!isCalendarConnected)}
            className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 ${
              isCalendarConnected 
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            {isCalendarConnected ? 'Disconnect Calendar' : 'Sign in with Google'}
          </button>
          {isCalendarConnected && (
            <span className="text-sm font-medium text-emerald-600">✓ Connected to workspace@xyz.com</span>
          )}
        </div>
      </div>
    </div>
  );
}
