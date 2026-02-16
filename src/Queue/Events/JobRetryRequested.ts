/**
 * JobRetryRequested Event
 *
 * Dispatched when a failed job is manually retried.
 */

export class JobRetryRequested {
  constructor(
    public readonly payload: string,
    public readonly connectionName: string,
    public readonly queue: string
  ) {}
}
