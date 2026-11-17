/**
 * Base class for domain-level (expected, user-facing) errors thrown by
 * server services and actions. Route handlers can rely on `instanceof
 * DomainError` to return the message to the client, while unexpected
 * internal errors are sanitized to a generic response (DEF-11-008).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
