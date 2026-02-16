/**
 * JobPayload
 *
 * Represents the serialized structure of a job stored in the queue.
 * This is the format that gets stored in the database/redis/etc.
 */

import { randomUUID } from 'crypto';
import type { Job } from './Job';

export interface JobPayloadData {
  uuid: string;
  displayName: string;
  job: string;
  data: Record<string, any>;
  maxTries: number | null;
  maxExceptions: number | null;
  failOnTimeout: boolean;
  backoff: number | number[] | null;
  timeout: number | null;
  retryUntil: number | null;
  attempts: number;
  afterCommit: boolean;
  pushedAt: string;
}

export class JobPayload {
  /**
   * Create a payload from a job instance
   */
  static create(job: Job): JobPayloadData {
    return {
      uuid: job.uuid || randomUUID(),
      displayName: job.displayName(),
      job: job.constructor.name,
      data: job.toJSON(),
      maxTries: job.tries ?? null,
      maxExceptions: job.maxExceptions ?? null,
      failOnTimeout: job.failOnTimeout ?? false,
      backoff: job.backoff ?? null,
      timeout: job.timeout ?? null,
      retryUntil: job.retryUntil ? job.retryUntil.getTime() : null,
      attempts: 0,
      afterCommit: job.afterCommit ?? false,
      pushedAt: new Date().toISOString(),
    };
  }

  /**
   * Serialize a payload to a JSON string
   */
  static serialize(payload: JobPayloadData): string {
    return JSON.stringify(payload);
  }

  /**
   * Deserialize a JSON string to a payload
   */
  static deserialize(raw: string): JobPayloadData {
    return JSON.parse(raw);
  }
}
