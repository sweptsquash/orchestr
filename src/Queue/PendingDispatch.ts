/**
 * PendingDispatch
 *
 * Provides a fluent interface for configuring job dispatch.
 * Mirrors Laravel's Illuminate\Foundation\Bus\PendingDispatch.
 *
 * @example
 * ```typescript
 * await ProcessPodcast.dispatch(podcastId)
 *   .onConnection('redis')
 *   .onQueue('processing')
 *   .delay(60);
 *
 * // The dispatch happens when the PendingDispatch is awaited
 * // or when .dispatch() is explicitly called
 * ```
 */

import type { Job } from './Job';
import type { QueueManager } from './QueueManager';

export class PendingDispatch implements PromiseLike<string> {
  protected _afterCommit: boolean = false;

  constructor(
    protected manager: QueueManager,
    protected job: Job
  ) {}

  /**
   * Set the desired connection for the job
   */
  onConnection(connection: string): this {
    this.job.connection = connection;
    return this;
  }

  /**
   * Set the desired queue for the job
   */
  onQueue(queue: string): this {
    this.job.queue = queue;
    return this;
  }

  /**
   * Set the delay for the job
   */
  delay(delay: number | Date): this {
    this.job.delay = delay;
    return this;
  }

  /**
   * Set the number of times the job may be attempted
   */
  tries(tries: number): this {
    this.job.tries = tries;
    return this;
  }

  /**
   * Set the timeout for the job
   */
  timeout(timeout: number): this {
    this.job.timeout = timeout;
    return this;
  }

  /**
   * Set the backoff strategy for the job
   */
  backoff(backoff: number | number[]): this {
    this.job.backoff = backoff;
    return this;
  }

  /**
   * Indicate that the job should be dispatched after all DB transactions commit
   */
  afterCommit(): this {
    this._afterCommit = true;
    this.job.afterCommit = true;
    return this;
  }

  /**
   * Indicate that the job should not wait for DB transactions
   */
  beforeCommit(): this {
    this._afterCommit = false;
    this.job.afterCommit = false;
    return this;
  }

  /**
   * Dispatch the job to the queue
   */
  async dispatch(): Promise<string> {
    return this.manager.dispatch(this.job);
  }

  /**
   * PromiseLike implementation - allows `await ProcessPodcast.dispatch(id)`
   */
  then<TResult1 = string, TResult2 = never>(
    onfulfilled?: ((value: string) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.dispatch().then(onfulfilled, onrejected);
  }
}
