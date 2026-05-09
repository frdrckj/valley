import type { UIMessage, DynamicToolUIPart } from "ai";
import { isToolUIPart } from "ai";
import { Icon } from "@/components/Icon";
import { ToolCallCard } from "../ToolCallCard";

interface Props {
  messages: UIMessage[];
  onApprove: (approvalId: string, approved: boolean) => void;
}

export function MessageList({ messages, onApprove }: Props) {
  return (
    <>
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.role}`}>
          <div className="who">
            {m.role === "user" ? (
              <>you</>
            ) : (
              <>
                <Icon name="sparkle" size={11} style={{ color: "var(--accent-ai)" }} />{" "}
                valley
              </>
            )}
          </div>
          {m.parts?.map((part, i) => {
            if (part.type === "text") {
              return (
                <div key={i} className="bubble">
                  {part.text}
                </div>
              );
            }
            if (isToolUIPart(part)) {
              const dynPart = part as DynamicToolUIPart;
              const isPending = dynPart.state === "approval-requested";
              const isDone =
                dynPart.state === "output-available" ||
                dynPart.state === "output-denied" ||
                dynPart.state === "approval-responded";
              const approvalId =
                isPending && dynPart.approval ? dynPart.approval.id : null;
              return (
                <ToolCallCard
                  key={i}
                  kind={mapToolName(dynPart.toolName)}
                  name={summarize(dynPart.input)}
                  status={isPending ? "pending" : isDone ? "approved" : "auto"}
                  onApprove={
                    approvalId
                      ? () => onApprove(approvalId, true)
                      : undefined
                  }
                  onReject={
                    approvalId
                      ? () => onApprove(approvalId, false)
                      : undefined
                  }
                />
              );
            }
            return null;
          })}
        </div>
      ))}
    </>
  );
}

function mapToolName(n: string): "file_read" | "write_file" | "run_command" {
  if (n === "read_file" || n === "list_directory") return "file_read";
  if (n === "write_file") return "write_file";
  return "run_command";
}

function summarize(input: unknown): string {
  if (typeof input === "object" && input !== null) {
    const o = input as Record<string, unknown>;
    if (typeof o.path === "string") return o.path;
    if (typeof o.command === "string") return o.command;
  }
  return "";
}
