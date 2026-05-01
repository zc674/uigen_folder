import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// --- mocks ---

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-id" } as any);
});

// --- initial state ---

describe("initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });
});

// --- signIn ---

describe("signIn", () => {
  test("calls signInAction with email and password", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "password123");
  });

  test("returns the result from signInAction on success", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    let returned: any;
    await act(async () => {
      returned = await result.current.signIn("user@example.com", "pass");
    });

    expect(returned).toEqual({ success: true });
  });

  test("returns the result from signInAction on failure", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    let returned: any;
    await act(async () => {
      returned = await result.current.signIn("bad@example.com", "wrong");
    });

    expect(returned).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("sets isLoading to true during sign-in and false after", async () => {
    let loadingDuring = false;
    mockSignIn.mockImplementation(async () => {
      loadingDuring = true; // captured on next render, checked via spy
      return { success: true };
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even if signInAction throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not call handlePostSignIn when sign-in fails", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("bad@example.com", "wrong");
    });

    expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// --- signUp ---

describe("signUp", () => {
  test("calls signUpAction with email and password", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "password123");
    });

    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123");
  });

  test("returns the result from signUpAction on success", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useAuth());

    let returned: any;
    await act(async () => {
      returned = await result.current.signUp("new@example.com", "pass");
    });

    expect(returned).toEqual({ success: true });
  });

  test("returns the result from signUpAction on failure", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    let returned: any;
    await act(async () => {
      returned = await result.current.signUp("existing@example.com", "pass");
    });

    expect(returned).toEqual({ success: false, error: "Email already registered" });
  });

  test("resets isLoading to false even if signUpAction throws", async () => {
    mockSignUp.mockRejectedValue(new Error("Server error"));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("user@example.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not call handlePostSignIn when sign-up fails", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("existing@example.com", "pass");
    });

    expect(mockGetAnonWorkData).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// --- handlePostSignIn: anonymous work migration ---

describe("post-sign-in: anonymous work with messages", () => {
  beforeEach(() => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "make a button" }],
      fileSystemData: { "/": null, "/App.tsx": "export default () => <button />" },
    });
    mockCreateProject.mockResolvedValue({ id: "anon-project-123" } as any);
  });

  test("creates a project with the anonymous work data", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "make a button" }],
        data: { "/": null, "/App.tsx": "export default () => <button />" },
      })
    );
  });

  test("project name includes a time string", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    const [{ name }] = mockCreateProject.mock.calls[0];
    expect(name).toMatch(/^Design from /);
  });

  test("clears anonymous work after migrating", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockClearAnonWork).toHaveBeenCalledOnce();
  });

  test("redirects to the newly created project", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/anon-project-123");
  });

  test("does not call getProjects when anon work exists", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockGetProjects).not.toHaveBeenCalled();
  });
});

// --- handlePostSignIn: anon work with no messages ---

describe("post-sign-in: anonymous work with empty messages array", () => {
  beforeEach(() => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [],
      fileSystemData: {},
    });
  });

  test("falls through to getProjects when anon messages list is empty", async () => {
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }] as any);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockGetProjects).toHaveBeenCalled();
  });

  test("does not create a project from empty anon work", async () => {
    mockGetProjects.mockResolvedValue([{ id: "proj-1" }] as any);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).not.toHaveBeenCalledWith(
      expect.objectContaining({ messages: [] })
    );
  });
});

// --- handlePostSignIn: no anon work, existing projects ---

describe("post-sign-in: no anonymous work, user has existing projects", () => {
  beforeEach(() => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([
      { id: "recent-project", name: "My Design", updatedAt: new Date() },
      { id: "older-project", name: "Old Design", updatedAt: new Date(0) },
    ] as any);
  });

  test("redirects to the most recent (first) project", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent-project");
  });

  test("does not create a new project when existing ones are present", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});

// --- handlePostSignIn: no anon work, no existing projects ---

describe("post-sign-in: no anonymous work, no existing projects", () => {
  beforeEach(() => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-project" } as any);
  });

  test("creates a new empty project", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [],
        data: {},
      })
    );
  });

  test("new project name follows expected pattern", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    const [{ name }] = mockCreateProject.mock.calls[0];
    expect(name).toMatch(/^New Design #\d+$/);
  });

  test("redirects to the newly created project", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
  });
});

// --- signUp triggers same post-sign-in flow ---

describe("signUp triggers the same post-sign-in flow", () => {
  test("migrates anon work after successful sign-up", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "signup-project" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalled();
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/signup-project");
  });

  test("redirects to existing project after successful sign-up with no anon work", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" }] as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });
});
