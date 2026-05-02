import { test, expect, vi, afterEach, beforeEach, describe } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainContent } from "../main-content";

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">Preview Content</div>,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">Code Editor</div>,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">File Tree</div>,
}));

vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions">Header Actions</div>,
}));

vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useFileSystem: () => ({}),
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useChat: () => ({}),
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: any) => (
    <div data-testid="resizable-group">{children}</div>
  ),
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("MainContent view toggle", () => {
  test("starts in preview mode showing PreviewFrame", async () => {
    render(<MainContent />);

    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
    expect(screen.queryByTestId("file-tree")).toBeNull();
  });

  test("Preview tab is active by default", async () => {
    render(<MainContent />);

    const previewTab = screen.getByRole("tab", { name: "Preview" });
    const codeTab = screen.getByRole("tab", { name: "Code" });

    expect(previewTab.getAttribute("data-state")).toBe("active");
    expect(codeTab.getAttribute("data-state")).toBe("inactive");
  });

  test("clicking Code tab switches to code view", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));

    expect(screen.queryByTestId("preview-frame")).toBeNull();
    expect(screen.getByTestId("code-editor")).toBeDefined();
    expect(screen.getByTestId("file-tree")).toBeDefined();
  });

  test("Code tab becomes active after clicking it", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));

    const previewTab = screen.getByRole("tab", { name: "Preview" });
    const codeTab = screen.getByRole("tab", { name: "Code" });

    expect(codeTab.getAttribute("data-state")).toBe("active");
    expect(previewTab.getAttribute("data-state")).toBe("inactive");
  });

  test("clicking Preview tab from code view switches back to preview", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("code-editor")).toBeDefined();

    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
    expect(screen.queryByTestId("file-tree")).toBeNull();
  });

  test("toggle works correctly across multiple switches", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole("tab", { name: "Code" }));
      expect(screen.getByTestId("code-editor")).toBeDefined();
      expect(screen.queryByTestId("preview-frame")).toBeNull();

      await user.click(screen.getByRole("tab", { name: "Preview" }));
      expect(screen.getByTestId("preview-frame")).toBeDefined();
      expect(screen.queryByTestId("code-editor")).toBeNull();
    }
  });

  test("clicking already-active tab does not break the view", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Click already-active Preview tab — should stay in preview
    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();

    // Switch to code and click Code again — should stay in code
    await user.click(screen.getByRole("tab", { name: "Code" }));
    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("code-editor")).toBeDefined();
    expect(screen.queryByTestId("preview-frame")).toBeNull();
  });
});
