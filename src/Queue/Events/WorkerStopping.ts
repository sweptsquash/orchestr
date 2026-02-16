/**
 * WorkerStopping Event
 *
 * Dispatched when a queue worker is stopping.
 */

export class WorkerStopping {
  constructor(
    public readonly status: number = 0,
    public readonly workerName?: string
  ) {}
}
