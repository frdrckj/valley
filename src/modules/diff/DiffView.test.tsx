import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiffView } from "./DiffView";

// Mock native so there's no Tauri invoke at test time.
vi.mock("@/lib/native", () => ({
  native: {
    git: {
      repoRoot: vi.fn(async () => null),
      diff: vi.fn(async () => ({ head: "", current: "", unified: "" })),
      status: vi.fn(async () => []),
    },
    fs: { readDir: vi.fn(async () => []) },
  },
}));

// @codemirror/merge uses browser DOM APIs not available in jsdom; stub it out.
vi.mock("@codemirror/merge", () => ({
  MergeView: class {
    constructor() {}
    destroy() {}
  },
}));

// Stub resolveLanguage to avoid dynamic import issues.
vi.mock("@/modules/file/lib/languageResolver", () => ({
  resolveLanguage: vi.fn(async () => null),
}));

// Stub buildSharedExtensions to return an empty array.
vi.mock("@/modules/file/lib/extensions", () => ({
  buildSharedExtensions: () => [],
  languageCompartment: { of: () => [] },
}));

// Stub EDITOR_THEMES to return an empty extension array.
vi.mock("@/modules/file/lib/editorThemes", () => ({
  EDITOR_THEMES: new Proxy({} as Record<string, []>, { get: () => [] }),
}));

// Stub settings.
vi.mock("@/lib/settings", () => ({
  useSettings: () => ({ theme: "gruvbox-material-dark" }),
}));

// Stub theme resolution.
vi.mock("@/modules/theme/themes", () => ({
  resolveTheme: (t: string) => t,
}));

// Stub Icon component.
vi.mock("@/components/Icon", () => ({
  Icon: () => null,
}));

describe("DiffView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    render(<DiffView path="/repo/src/foo.ts" mode="working" />);
    expect(screen.getByText(/loading diff/i)).toBeDefined();
  });

  it("renders error when no path provided", async () => {
    render(<DiffView path="" mode="working" />);
    expect(screen.getByText(/no file path/i)).toBeDefined();
  });
});
