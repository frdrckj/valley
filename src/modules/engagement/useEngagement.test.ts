import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/plugin-store", () => {
  const data = new Map<string, unknown>();
  return {
    Store: {
      async load() {
        return {
          get: async (k: string) => data.get(k),
          set: async (k: string, v: unknown) => void data.set(k, v),
          save: async () => {},
        };
      },
    },
  };
});

import { useEngagement } from "./useEngagement";

beforeEach(() => {
  useEngagement.setState({ engagements: [], activeId: null });
});

describe("useEngagement", () => {
  it("create then active() returns the new engagement", async () => {
    const eng = await useEngagement.getState().create({
      name: "test-corp",
      scope: ["test.corp"],
      rootDir: "/tmp/test",
    });
    expect(useEngagement.getState().active()).toMatchObject({ id: eng.id, name: "test-corp" });
  });

  it("create twice — activeId follows the newest", async () => {
    await useEngagement.getState().create({ name: "first", scope: [], rootDir: "/tmp/a" });
    const second = await useEngagement.getState().create({ name: "second", scope: [], rootDir: "/tmp/b" });
    expect(useEngagement.getState().activeId).toBe(second.id);
  });

  it("update touches updatedMs", async () => {
    const eng = await useEngagement.getState().create({ name: "alpha", scope: [], rootDir: "/tmp" });
    const before = useEngagement.getState().engagements.find((e) => e.id === eng.id)!.updatedMs;
    await new Promise((r) => setTimeout(r, 2));
    await useEngagement.getState().update(eng.id, { name: "alpha-updated" });
    const after = useEngagement.getState().engagements.find((e) => e.id === eng.id)!.updatedMs;
    expect(after).toBeGreaterThan(before);
    expect(useEngagement.getState().active()?.name).toBe("alpha-updated");
  });

  it("remove of active engagement clears activeId", async () => {
    const eng = await useEngagement.getState().create({ name: "target", scope: [], rootDir: "/tmp" });
    expect(useEngagement.getState().activeId).toBe(eng.id);
    await useEngagement.getState().remove(eng.id);
    expect(useEngagement.getState().activeId).toBeNull();
    expect(useEngagement.getState().engagements).toHaveLength(0);
  });

  it("remove of non-active engagement does not clear activeId", async () => {
    const a = await useEngagement.getState().create({ name: "keep", scope: [], rootDir: "/tmp/a" });
    const b = await useEngagement.getState().create({ name: "drop", scope: [], rootDir: "/tmp/b" });
    // b is active now; remove a
    await useEngagement.getState().remove(a.id);
    expect(useEngagement.getState().activeId).toBe(b.id);
  });

  it("engagements are sorted newest-first by updatedMs after create", async () => {
    const a = await useEngagement.getState().create({ name: "a", scope: [], rootDir: "/tmp/a" });
    await new Promise((r) => setTimeout(r, 2));
    const b = await useEngagement.getState().create({ name: "b", scope: [], rootDir: "/tmp/b" });
    const ids = useEngagement.getState().engagements.map((e) => e.id);
    // b was created last so it should appear first (newest-first)
    expect(ids[0]).toBe(b.id);
    expect(ids[1]).toBe(a.id);
  });
});
