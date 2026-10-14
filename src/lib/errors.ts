/** An error that maps cleanly onto an HTTP response. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string) => new AppError(404, `${what} not found`);
export const badRequest = (message: string, details?: unknown) => new AppError(400, message, details);
export const conflict = (message: string, details?: unknown) => new AppError(409, message, details);
