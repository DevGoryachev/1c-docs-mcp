import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

export type AppErrorType = "invalid_input" | "not_found" | "internal_error";

export class AppError extends Error {
  public readonly type: AppErrorType;

  public constructor(type: AppErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = "AppError";
  }
}

export function invalidInput(message: string): AppError {
  return new AppError("invalid_input", message);
}

export function notFound(message: string): AppError {
  return new AppError("not_found", message);
}

export function internalError(message: string): AppError {
  return new AppError("internal_error", message);
}

export function normalizeError(error: unknown): { type: AppErrorType; message: string } {
  if (error instanceof AppError) {
    return { type: error.type, message: error.message };
  }
  if (error instanceof McpError) {
    const parsed = tryParseErrorJson(error.message);
    if (parsed) {
      return parsed;
    }
    return { type: "internal_error", message: "Internal server error." };
  }
  if (error instanceof Error) {
    return { type: "internal_error", message: error.message || "Internal server error." };
  }
  return { type: "internal_error", message: "Internal server error." };
}

export function asMcpInvalidParams(type: AppErrorType, message: string): McpError {
  return new McpError(
    ErrorCode.InvalidParams,
    JSON.stringify(
      {
        error: {
          type,
          message
        }
      },
      null,
      2
    )
  );
}

function tryParseErrorJson(input: string): { type: AppErrorType; message: string } | null {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const error = (parsed as Record<string, unknown>).error;
    if (typeof error !== "object" || error === null || Array.isArray(error)) {
      return null;
    }
    const type = (error as Record<string, unknown>).type;
    const message = (error as Record<string, unknown>).message;
    if ((type === "invalid_input" || type === "not_found" || type === "internal_error") && typeof message === "string") {
      return { type, message };
    }
    return null;
  } catch {
    return null;
  }
}
