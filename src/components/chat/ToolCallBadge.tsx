"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

type StrReplaceArgs = {
  command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
  path: string;
};

type FileManagerArgs = {
  command: "rename" | "delete";
  path: string;
  new_path?: string;
};

export function getToolMessage(toolName: string, args: unknown, isDone: boolean): string {
  const getFilename = (p: string) => p.split("/").pop() ?? p;

  if (toolName === "str_replace_editor") {
    const a = args as StrReplaceArgs;
    if (!a?.path || !a?.command) return toolName;
    const file = getFilename(a.path);
    switch (a.command) {
      case "create":     return isDone ? `Created ${file}`       : `Creating ${file}`;
      case "str_replace":
      case "insert":     return isDone ? `Edited ${file}`        : `Editing ${file}`;
      case "view":       return isDone ? `Read ${file}`          : `Reading ${file}`;
      case "undo_edit":  return isDone ? `Undid edit to ${file}` : `Undoing edit to ${file}`;
    }
  }

  if (toolName === "file_manager") {
    const a = args as FileManagerArgs;
    if (!a?.path || !a?.command) return toolName;
    const file = getFilename(a.path);
    switch (a.command) {
      case "rename": {
        const newFile = a.new_path ? getFilename(a.new_path) : "unknown";
        return isDone ? `Renamed ${file} to ${newFile}` : `Renaming ${file} to ${newFile}`;
      }
      case "delete": return isDone ? `Deleted ${file}` : `Deleting ${file}`;
    }
  }

  return toolName;
}

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocation;
}

export function ToolCallBadge({ toolInvocation }: ToolCallBadgeProps) {
  const isDone = toolInvocation.state === "result" && !!toolInvocation.result;
  const message = getToolMessage(toolInvocation.toolName, toolInvocation.args, isDone);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{message}</span>
    </div>
  );
}
