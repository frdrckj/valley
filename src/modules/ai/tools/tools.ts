import { tool } from "ai";
import { z } from "zod";
import { native } from "@/lib/native";
import { deny } from "../lib/security";

export const tools = {
  read_file: tool({
    description: "Read a UTF-8 text file by absolute path. Auto-executes (no approval).",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => {
      if (deny(path)) throw new Error(`refused: secret-like path "${path}"`);
      const contents = await native.fs.readText(path);
      return { path, contents };
    },
  }),

  list_directory: tool({
    description: "List entries of a directory by absolute path. Auto-executes.",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => {
      const entries = await native.fs.readDir(path);
      return { path, entries };
    },
  }),

  write_file: tool({
    description: "Write a UTF-8 text file by absolute path. REQUIRES USER APPROVAL.",
    inputSchema: z.object({ path: z.string(), contents: z.string() }),
    needsApproval: true,
    execute: async ({ path, contents }) => {
      if (deny(path)) throw new Error(`refused: secret-like path "${path}"`);
      await native.fs.writeFile(path, contents);
      return { path, bytes: contents.length };
    },
  }),

  run_command: tool({
    description: "Run a shell command via /bin/sh -c. REQUIRES USER APPROVAL.",
    inputSchema: z.object({ command: z.string(), cwd: z.string().optional() }),
    needsApproval: true,
    execute: async ({ command, cwd }) => {
      const r = await native.shell.run(command, cwd);
      return r;
    },
  }),
};
