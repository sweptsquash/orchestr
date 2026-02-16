/**
 * WorkerOptions
 *
 * Configuration options for the queue worker process.
 * Mirrors Laravel's Illuminate\Queue\WorkerOptions.
 */

export interface WorkerOptions {
  /**
   * Worker name (for identification)
   */
  name?: string;

  /**
   * The number of seconds to wait before polling for new jobs
   * @default 3
   */
  sleep?: number;

  /**
   * The maximum number of times a job should be attempted
   * Used as default when the job doesn't specify its own tries
   * @default 1
   */
  tries?: number;

  /**
   * The number of seconds a child process can run
   * @default 60
   */
  timeout?: number;

  /**
   * The memory limit in megabytes
   * @default 128
   */
  memory?: number;

  /**
   * The maximum number of jobs to process before stopping
   */
  maxJobs?: number;

  /**
   * The maximum number of seconds the worker should run
   */
  maxTime?: number;

  /**
   * Force the worker to run even in maintenance mode
   * @default false
   */
  force?: boolean;

  /**
   * Stop the worker when the queue is empty
   * @default false
   */
  stopWhenEmpty?: boolean;

  /**
   * The number of seconds to wait before retrying a job that encountered an uncaught exception
   */
  backoff?: number | number[];

  /**
   * The number of seconds to rest between jobs
   * @default 0
   */
  rest?: number;
}

export const DEFAULT_WORKER_OPTIONS: Required<WorkerOptions> = {
  name: 'default',
  sleep: 3,
  tries: 1,
  timeout: 60,
  memory: 128,
  maxJobs: 0,
  maxTime: 0,
  force: false,
  stopWhenEmpty: false,
  backoff: 0,
  rest: 0,
};
