import { Store } from "@tauri-apps/plugin-store";

const FILE = "valley-sessions.json";

export interface SessionMeta {
  id: string;
  title: string;
  createdMs: number;
  updatedMs: number;
}

let store: Awaited<ReturnType<typeof Store.load>> | null = null;
let list: SessionMeta[] = [];
let activeId: string | null = null;

async function getStore() {
  if (!store) store = await Store.load(FILE);
  return store;
}

export async function hydrateSessions() {
  store = null;
  const s = await getStore();
  list = (await s.get<SessionMeta[]>("list")) ?? [];
  activeId = (await s.get<string | null>("activeId")) ?? null;
}

async function persist() {
  const s = await getStore();
  await s.set("list", list);
  await s.set("activeId", activeId);
  await s.save();
}

export async function listSessions(): Promise<SessionMeta[]> {
  return [...list].sort((a, b) => b.updatedMs - a.updatedMs);
}

export async function createSession(input: { title?: string } = {}): Promise<SessionMeta> {
  const id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const meta: SessionMeta = {
    id,
    title: input.title ?? "untitled",
    createdMs: now,
    updatedMs: now,
  };
  list.push(meta);
  activeId = id;
  await persist();
  return meta;
}

export async function deleteSession(id: string) {
  list = list.filter((s) => s.id !== id);
  if (activeId === id) {
    activeId = list[list.length - 1]?.id ?? null;
  }
  const s = await getStore();
  await s.delete(`messages:${id}`);
  await persist();
}

export async function setActiveSession(id: string) {
  if (list.some((s) => s.id === id)) {
    activeId = id;
    await persist();
  }
}

export async function getActiveSession(): Promise<SessionMeta | null> {
  return list.find((s) => s.id === activeId) ?? null;
}

export async function setSessionTitle(id: string, title: string) {
  const idx = list.findIndex((s) => s.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], title, updatedMs: Date.now() };
    await persist();
  }
}

export async function loadMessages<T>(id: string): Promise<T[]> {
  const s = await getStore();
  return (await s.get<T[]>(`messages:${id}`)) ?? [];
}

export async function saveMessages<T>(id: string, messages: T[]) {
  const s = await getStore();
  await s.set(`messages:${id}`, messages);
  await s.save();
  const idx = list.findIndex((m) => m.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], updatedMs: Date.now() };
    await persist();
  }
}

/** Wipe a session's persisted messages, keep the session metadata. */
export async function clearMessages(id: string) {
  const s = await getStore();
  await s.delete(`messages:${id}`);
  await s.save();
  const idx = list.findIndex((m) => m.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], updatedMs: Date.now() };
    await persist();
  }
}
