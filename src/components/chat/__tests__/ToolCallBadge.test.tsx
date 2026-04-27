import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ToolInvocation } from "ai";
import { ToolCallBadge, getToolMessage } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// --- getToolMessage unit tests ---

test("getToolMessage: str_replace_editor create loading", () => {
  expect(getToolMessage("str_replace_editor", { command: "create", path: "src/App.tsx" }, false)).toBe("Creating App.tsx");
});

test("getToolMessage: str_replace_editor create done", () => {
  expect(getToolMessage("str_replace_editor", { command: "create", path: "src/App.tsx" }, true)).toBe("Created App.tsx");
});

test("getToolMessage: str_replace_editor str_replace loading", () => {
  expect(getToolMessage("str_replace_editor", { command: "str_replace", path: "Button.tsx" }, false)).toBe("Editing Button.tsx");
});

test("getToolMessage: str_replace_editor str_replace done", () => {
  expect(getToolMessage("str_replace_editor", { command: "str_replace", path: "Button.tsx" }, true)).toBe("Edited Button.tsx");
});

test("getToolMessage: str_replace_editor insert loading", () => {
  expect(getToolMessage("str_replace_editor", { command: "insert", path: "Button.tsx" }, false)).toBe("Editing Button.tsx");
});

test("getToolMessage: str_replace_editor insert done", () => {
  expect(getToolMessage("str_replace_editor", { command: "insert", path: "Button.tsx" }, true)).toBe("Edited Button.tsx");
});

test("getToolMessage: str_replace_editor view loading", () => {
  expect(getToolMessage("str_replace_editor", { command: "view", path: "utils.ts" }, false)).toBe("Reading utils.ts");
});

test("getToolMessage: str_replace_editor view done", () => {
  expect(getToolMessage("str_replace_editor", { command: "view", path: "utils.ts" }, true)).toBe("Read utils.ts");
});

test("getToolMessage: str_replace_editor undo_edit loading", () => {
  expect(getToolMessage("str_replace_editor", { command: "undo_edit", path: "App.tsx" }, false)).toBe("Undoing edit to App.tsx");
});

test("getToolMessage: str_replace_editor undo_edit done", () => {
  expect(getToolMessage("str_replace_editor", { command: "undo_edit", path: "App.tsx" }, true)).toBe("Undid edit to App.tsx");
});

test("getToolMessage: file_manager rename loading", () => {
  expect(getToolMessage("file_manager", { command: "rename", path: "OldName.tsx", new_path: "NewName.tsx" }, false)).toBe("Renaming OldName.tsx to NewName.tsx");
});

test("getToolMessage: file_manager rename done", () => {
  expect(getToolMessage("file_manager", { command: "rename", path: "OldName.tsx", new_path: "NewName.tsx" }, true)).toBe("Renamed OldName.tsx to NewName.tsx");
});

test("getToolMessage: file_manager delete loading", () => {
  expect(getToolMessage("file_manager", { command: "delete", path: "OldFile.tsx" }, false)).toBe("Deleting OldFile.tsx");
});

test("getToolMessage: file_manager delete done", () => {
  expect(getToolMessage("file_manager", { command: "delete", path: "OldFile.tsx" }, true)).toBe("Deleted OldFile.tsx");
});

test("getToolMessage: extracts filename from nested path", () => {
  expect(getToolMessage("str_replace_editor", { command: "view", path: "src/components/ui/Card.tsx" }, false)).toBe("Reading Card.tsx");
});

test("getToolMessage: unknown tool returns raw tool name", () => {
  expect(getToolMessage("some_other_tool", {}, false)).toBe("some_other_tool");
});

test("getToolMessage: null args returns raw tool name", () => {
  expect(getToolMessage("str_replace_editor", null, false)).toBe("str_replace_editor");
});

test("getToolMessage: missing path returns raw tool name", () => {
  expect(getToolMessage("str_replace_editor", { command: "create" }, false)).toBe("str_replace_editor");
});

test("getToolMessage: file_manager rename with no new_path", () => {
  expect(getToolMessage("file_manager", { command: "rename", path: "File.tsx" }, false)).toBe("Renaming File.tsx to unknown");
});

// --- Rendered component tests ---

test("ToolCallBadge renders green dot when done", () => {
  const tool: ToolInvocation = {
    state: "result",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "App.tsx" },
    result: "ok",
  };
  const { container } = render(<ToolCallBadge toolInvocation={tool} />);
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
});

test("ToolCallBadge renders spinner when state is call", () => {
  const tool: ToolInvocation = {
    state: "call",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "App.tsx" },
  };
  const { container } = render(<ToolCallBadge toolInvocation={tool} />);
  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("ToolCallBadge renders spinner when state is partial-call", () => {
  const tool: ToolInvocation = {
    state: "partial-call",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "App.tsx" },
  };
  const { container } = render(<ToolCallBadge toolInvocation={tool} />);
  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("ToolCallBadge renders spinner when result is falsy", () => {
  const tool: ToolInvocation = {
    state: "result",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "App.tsx" },
    result: "",
  };
  const { container } = render(<ToolCallBadge toolInvocation={tool} />);
  expect(container.querySelector(".animate-spin")).toBeDefined();
});

test("ToolCallBadge shows friendly text", () => {
  const tool: ToolInvocation = {
    state: "result",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "App.tsx" },
    result: "ok",
  };
  render(<ToolCallBadge toolInvocation={tool} />);
  expect(screen.getByText("Created App.tsx")).toBeDefined();
});

test("ToolCallBadge shows in-progress text", () => {
  const tool: ToolInvocation = {
    state: "call",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "str_replace", path: "src/components/Button.tsx" },
  };
  render(<ToolCallBadge toolInvocation={tool} />);
  expect(screen.getByText("Editing Button.tsx")).toBeDefined();
});

test("ToolCallBadge falls back to tool name for empty args", () => {
  const tool: ToolInvocation = {
    state: "result",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: {},
    result: "ok",
  };
  render(<ToolCallBadge toolInvocation={tool} />);
  expect(screen.getByText("str_replace_editor")).toBeDefined();
});
