/**
 * QueueManager
 *
 * Manages multiple queue connections and drivers.
 * Follows the same Manager pattern as DatabaseManager.
 *
 * Mirrors Laravel's Illuminate\Queue\QueueManager.
 */

import type { QueueDriver } from './Contracts/QueueDriver';
import type { Job } from './Job';
import type { Worker } from './Workers/Worker';
import type { WorkerOptions } from './Workers/WorkerOptions';
import { JobPayload } from './JobPayload';

export interface QueueConnectionConfig {
  driver: string;
  connection?: string;
  table?: string;
  queue?: string;
  retry_after?: number;
  block_for?: number | null;
  after_commit?: boolean;
  [key: string]: any;
}

export interface QueueFailedConfig {
  driver: string;
  database?: string;
  table?: string;
}

export interface QueueBatchingConfig {
  database: string;
  table: string;
}

export interface QueueConfig {
  default: string;
  connections: Record<string, QueueConnectionConfig>;
  batching?: QueueBatchingConfig;
  failed?: QueueFailedConfig;
}

export type DriverFactory = (config: QueueConnectionConfig) => QueueDriver;

export class QueueManager {
  protected connections: Map<string, QueueDriver> = new Map();
  protected driverFactories: Map<string, DriverFactory> = new Map();
  protected jobRegistry: Map<string, new (...args: any[]) => Job> = new Map();

  /**
   * Event callbacks
   */
  protected beforeCallbacks: Array<(connectionName: string, job: Job) => void> = [];
  protected afterCallbacks: Array<(connectionName: string, job: Job) => void> = [];
  protected failingCallbacks: Array<(connectionName: string, job: Job, error: Error) => void> = [];
  protected loopingCallbacks: Array<() => void> = [];

  constructor(protected config: QueueConfig) {}

  /**
   * Register a queue driver factory
   */
  registerDriver(name: string, factory: DriverFactory): void {
    this.driverFactories.set(name, factory);
  }

  /**
   * Register a job class for deserialization
   */
  registerJob(name: string, jobClass: new (...args: any[]) => Job): void {
    this.jobRegistry.set(name, jobClass);
  }

  /**
   * Get a job class from the registry
   */
  getJobClass(name: string): (new (...args: any[]) => Job) | undefined {
    return this.jobRegistry.get(name);
  }

  /**
   * Get a queue connection instance
   */
  connection(name?: string): QueueDriver {
    const connectionName = name || this.config.default;

    if (this.connections.has(connectionName)) {
      return this.connections.get(connectionName)!;
    }

    const driver = this.createConnection(connectionName);
    this.connections.set(connectionName, driver);

    return driver;
  }

  /**
   * Create a new queue connection
   */
  protected createConnection(name: string): QueueDriver {
    const config = this.config.connections[name];

    if (!config) {
      throw new Error(`Queue connection [${name}] not configured.`);
    }

    const factory = this.driverFactories.get(config.driver);

    if (!factory) {
      throw new Error(
        `Queue driver [${config.driver}] not registered. Available drivers: ${Array.from(this.driverFactories.keys()).join(', ')}`
      );
    }

    const driver = factory(config);
    driver.setConnectionName(name);

    return driver;
  }

  /**
   * Dispatch a job to its configured connection and queue
   */
  async dispatch(job: Job): Promise<string> {
    const connectionName = job.connection || this.config.default;
    const driver = this.connection(connectionName);
    const queue = job.queue;

    if (job.delay) {
      return driver.later(job.delay, job, queue);
    }

    return driver.push(job, queue);
  }

  /**
   * Dispatch a job synchronously (bypass queue, execute immediately)
   */
  async dispatchSync(job: Job): Promise<void> {
    try {
      await job.handle();
    } catch (error) {
      if (job.failed) {
        await job.failed(error as Error);
      }
      throw error;
    }
  }

  /**
   * Push a job onto a specific queue
   */
  async push(job: Job, queue?: string): Promise<string> {
    const connectionName = job.connection || this.config.default;
    return this.connection(connectionName).push(job, queue);
  }

  /**
   * Push a job onto a specific named queue
   */
  async pushOn(queue: string, job: Job): Promise<string> {
    job.queue = queue;
    return this.push(job);
  }

  /**
   * Push a job after a delay
   */
  async later(delay: number | Date, job: Job, queue?: string): Promise<string> {
    const connectionName = job.connection || this.config.default;
    return this.connection(connectionName).later(delay, job, queue);
  }

  /**
   * Push multiple jobs onto the queue
   */
  async bulk(jobs: Job[], queue?: string): Promise<void> {
    const connectionName = this.config.default;
    return this.connection(connectionName).bulk(jobs, queue);
  }

  /**
   * Register a callback to be called before a job is processed
   */
  before(callback: (connectionName: string, job: Job) => void): void {
    this.beforeCallbacks.push(callback);
  }

  /**
   * Register a callback to be called after a job is processed
   */
  after(callback: (connectionName: string, job: Job) => void): void {
    this.afterCallbacks.push(callback);
  }

  /**
   * Register a callback to be called when a job fails
   */
  failing(callback: (connectionName: string, job: Job, error: Error) => void): void {
    this.failingCallbacks.push(callback);
  }

  /**
   * Register a callback to be called on each worker loop iteration
   */
  looping(callback: () => void): void {
    this.loopingCallbacks.push(callback);
  }

  /**
   * Fire the before job callbacks
   */
  fireBeforeCallbacks(connectionName: string, job: Job): void {
    for (const callback of this.beforeCallbacks) {
      callback(connectionName, job);
    }
  }

  /**
   * Fire the after job callbacks
   */
  fireAfterCallbacks(connectionName: string, job: Job): void {
    for (const callback of this.afterCallbacks) {
      callback(connectionName, job);
    }
  }

  /**
   * Fire the failing job callbacks
   */
  fireFailingCallbacks(connectionName: string, job: Job, error: Error): void {
    for (const callback of this.failingCallbacks) {
      callback(connectionName, job, error);
    }
  }

  /**
   * Fire the looping callbacks
   */
  fireLoopingCallbacks(): void {
    for (const callback of this.loopingCallbacks) {
      callback();
    }
  }

  /**
   * Disconnect from a queue connection
   */
  disconnect(name?: string): void {
    const connectionName = name || this.config.default;
    this.connections.delete(connectionName);
  }

  /**
   * Get the default connection name
   */
  getDefaultConnection(): string {
    return this.config.default;
  }

  /**
   * Set the default connection name
   */
  setDefaultConnection(name: string): void {
    this.config.default = name;
  }

  /**
   * Get all connection names
   */
  getConnections(): string[] {
    return Object.keys(this.config.connections);
  }

  /**
   * Get the queue configuration
   */
  getConfig(): QueueConfig {
    return this.config;
  }

  /**
   * Get the connection configuration
   */
  getConnectionConfig(name?: string): QueueConnectionConfig {
    const connectionName = name || this.config.default;
    const config = this.config.connections[connectionName];

    if (!config) {
      throw new Error(`Queue connection [${connectionName}] not configured.`);
    }

    return config;
  }
}
