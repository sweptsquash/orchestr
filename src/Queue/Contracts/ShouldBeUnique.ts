/**
 * ShouldBeUnique Contract
 *
 * When a job implements this interface, the queue system will
 * ensure that only one instance of the job with the same unique
 * ID is on the queue at any given time.
 *
 * Mirrors Laravel's Illuminate\Contracts\Queue\ShouldBeUnique.
 *
 * @example
 * ```typescript
 * class UpdateSearchIndex extends Job implements ShouldBeUnique {
 *   public uniqueFor = 3600; // Lock for 1 hour
 *
 *   uniqueId(): string {
 *     return `search-index-${this.productId}`;
 *   }
 * }
 * ```
 */
export interface ShouldBeUnique {
  /**
   * The unique ID used to prevent duplicate jobs
   */
  uniqueId(): string;

  /**
   * The number of seconds after which the unique lock will be released
   */
  uniqueFor?: number;
}

/**
 * ShouldBeUniqueUntilProcessing Contract
 *
 * Similar to ShouldBeUnique, but the lock is released when
 * the job begins processing rather than when it completes.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ShouldBeUniqueUntilProcessing extends ShouldBeUnique {}

/**
 * Type guard to check if a job implements ShouldBeUnique
 */
export function isShouldBeUnique(job: any): job is ShouldBeUnique {
  return job !== null && typeof job === 'object' && typeof job.uniqueId === 'function';
}
