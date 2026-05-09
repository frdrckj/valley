import { describe, it, expect, beforeEach, vi } from "vitest";

let mockData = new Map<string, unknown>();

vi.mock("@tauri-apps/plugin-store", () => {
  return {
    Store: {
      async load() {
        return {
          get: async (k: string) => mockData.get(k),
          set: async (k: string, v: unknown) => void mockData.set(k, v),
          delete: async (k: string) => void mockData.delete(k),
          save: async () => {},
        };
      },
    },
  };
});

import { createSession, listSessions, deleteSession, setActiveSession, hydrateSessions, getActiveSession } from "./sessions";

beforeEach(async () => {
  mockData = new Map();
  await hydrateSessions();
});

describe("sessions", () => {
  it("creates and lists a session", async () => {
    const s = await createSession({ title: "first" });
    const all = await listSessions();
    expect(all).toContainEqual(expect.objectContaining({ id: s.id, title: "first" }));
  });

  it("active session is the most recently created by default", async () => {
    const a = await createSession({ title: "a" });
    const b = await createSession({ title: "b" });
    expect(await getActiveSession()).toEqual(expect.objectContaining({ id: b.id }));
    await setActiveSession(a.id);
    expect(await getActiveSession()).toEqual(expect.objectContaining({ id: a.id }));
  });

  it("deleting the active session falls back to the previous", async () => {
    const a = await createSession({ title: "a" });
    const b = await createSession({ title: "b" });
    await deleteSession(b.id);
    expect((await getActiveSession())?.id).toBe(a.id);
  });
});
