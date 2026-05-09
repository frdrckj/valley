import { describe, expect, it, beforeEach } from "vitest";
import { useTabs } from "./useTabs";

beforeEach(() => {
  useTabs.setState({ tabs: [], activeId: null });
});

describe("useTabs", () => {
  it("opens a tab and activates it", () => {
    const id = useTabs.getState().open({ kind: "terminal", label: "main" });
    const s = useTabs.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.activeId).toBe(id);
  });

  it("closing the active tab activates the previous", () => {
    const a = useTabs.getState().open({ kind: "terminal", label: "a" });
    const b = useTabs.getState().open({ kind: "terminal", label: "b" });
    useTabs.getState().close(b);
    expect(useTabs.getState().activeId).toBe(a);
  });

  it("closing a non-active tab keeps activeId", () => {
    const a = useTabs.getState().open({ kind: "terminal", label: "a" });
    useTabs.getState().open({ kind: "terminal", label: "b" });
    useTabs.getState().close(a);
    expect(useTabs.getState().tabs.map((t) => t.label)).toEqual(["b"]);
  });

  it("auto-updates label from cwd until the user renames", () => {
    const id = useTabs.getState().open({ kind: "terminal", label: "zsh" });
    useTabs.getState().setCwd(id, "/Users/me/Documents/works/valley");
    expect(useTabs.getState().tabs[0].label).toBe("valley");

    useTabs.getState().setCwd(id, "/Users/me");
    expect(useTabs.getState().tabs[0].label).toBe("~");

    useTabs.getState().rename(id, "build");
    useTabs.getState().setCwd(id, "/tmp/something/else");
    // After explicit rename, cwd no longer drives the label.
    expect(useTabs.getState().tabs[0].label).toBe("build");
  });

  it("preview tabs ignore cwd-based labelling", () => {
    const id = useTabs.getState().open({
      kind: "preview",
      label: "preview",
      url: "http://localhost:3000",
    });
    useTabs.getState().setCwd(id, "/Users/me/code");
    expect(useTabs.getState().tabs[0].label).toBe("preview");
  });
});
