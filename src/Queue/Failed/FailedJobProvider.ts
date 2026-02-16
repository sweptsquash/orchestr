/**
 * FailedJobProvider Contract
 *
 * Defines the interface for failed job storage implementations.
 * Mirrors Laravel's Illuminate\Queue\Failed\FailedJobProviderInterface.
 */

export interface FailedJobRecord {
  id: number | string;
  uuid: string;
  connection: string;
  queue: string;
  payload: string;
  exception: string;
  failed_at: string;
}

export interface FailedJobProvider {
  /**
   * Log a failed job
   */
  log(
    connection: string,
    queue: string,
    payload: string,
    exception: Error
  ): Promise<string | number>;

  /**
   * Get a list of all failed jobs
   */
  all(): Promise<FailedJobRecord[]>;

  /**
   * Get a single failed job by ID
   */
  find(id: string | number): Promise<FailedJobRecord | null>;

  /**
   * Delete a single failed job
   */
  forget(id: string | number): Promise<boolean>;

  /**
   * Delete all failed jobs
   */
  flush(hours?: number): Promise<void>;

  /**
   * Count all failed jobs
   */
  count(connection?: string, queue?: string): Promise<number>;
}
