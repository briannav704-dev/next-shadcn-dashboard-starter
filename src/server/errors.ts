export type AppErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHENTICATED'
  | 'INVALID'
  | 'CONFLICT'
  | 'UPSTREAM';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Message that is safe to show in the UI: never leaks driver or SQL details. */
export function publicMessage(error: unknown): string {
  if (isAppError(error) && error.code !== 'UPSTREAM') return error.message;
  return 'Something went wrong. Please try again.';
}
