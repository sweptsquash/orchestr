/**
 * PendingChain
 *
 * Fluent builder for chaining multiple jobs together.
 * Jobs in a chain are executed sequentially - if one fails,
 * the remaining jobs in the chain are not executed.
 *
 * Mirrors Laravel's Illuminate\Foundation\Bus\PendingChain.
 *
 * @example
 * ```typescript
 * await Bus.chain([
 *   new ProcessPodcast(id),
 *   new OptimizePodcast(id),
 *   new ReleasePodcast(id),
 * ])
 *   .onConnection('redis')
 *   .onQueue('processing')
 *   .catch((error) => console.error('Chain failed:', error))
 *   .dispatch();
 * ```
 */

import type { Job } from './Job';
import type { QueueManager } from './QueueManager';

export class PendingChain {
  protected _connection?: string;
  protected _queue?: string;
  protected _delay?: number | Date;
  protected _catchCallback?: (error: Error) => void | Promise<void>;
  protected _finallyCallback?: () => void | Promise<void>;

  constructor(
    protected manager: QueueManager,
    protected jobs: Job[]
  ) {}

  /**
   * Set the connection for all jobs in the chain
   */
  onConnection(connection: string): this {
    this._connection = connection;
    return this;
  }

  /**
   * Set the queue for all jobs in the chain
   */
  onQueue(queue: string): this {
    this._queue = queue;
    return this;
  }

  /**
   * Set the delay before the first job starts
   */
  delay(delay: number | Date): this {
    this._delay = delay;
    return this;
  }

  /**
   * Set a callback to execute if any job in the chain fails
   */
  catch(callback: (error: Error) => void | Promise<void>): this {
    this._catchCallback = callback;
    return this;
  }

  /**
   * Set a callback to execute when the chain completes (success or failure)
   */
  finally(callback: () => void | Promise<void>): this {
    this._finallyCallback = callback;
    return this;
  }

  /**
   * Dispatch the chain
   *
   * The first job is dispatched immediately. Each subsequent job
   * stores the remaining chain and dispatches the next job upon
   * successful completion.
   */
  async dispatch(): Promise<string> {
    if (this.jobs.length === 0) {
      throw new Error('Cannot dispatch an empty chain.');
    }

    // Apply connection/queue to all jobs
    for (const job of this.jobs) {
      if (this._connection) {
        job.connection = this._connection;
      }
      if (this._queue) {
        job.queue = this._queue;
      }
    }

    // Store chain metadata on the first job
    const firstJob = this.jobs[0];
    const remainingJobs = this.jobs.slice(1);

    // Store chain info as serializable data
    (firstJob as any)._chainJobs = remainingJobs.map((j) => ({
      class: j.constructor.name,
      data: j.toJSON(),
    }));
    (firstJob as any)._chainCatch = this._catchCallback;
    (firstJob as any)._chainFinally = this._finallyCallback;

    // Apply delay to first job only
    if (this._delay) {
      firstJob.delay = this._delay;
    }

    return this.manager.dispatch(firstJob);
  }
}
