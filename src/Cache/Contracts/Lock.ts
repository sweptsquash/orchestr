/**
 * Lock Contract
 *
 * Defines the interface for atomic lock implementations.
 * Mirrors Laravel's Illuminate\Contracts\Cache\Lock.
 */
export interface LockContract {
  /**
   * Attempt to acquire the lock.
   */
  get(): Promise<boolean>;
  /**
   * Attempt to acquire the lock.
   * If a callback is provided, it will be executed and the lock released automatically.
   */
  get<T = any>(callback: () => Promise<T> | T): Promise<T>;

  /**
   * Attempt to acquire the lock for the given number of seconds.
   * Blocks until the lock is acquired or the timeout is reached.
   */
  block(seconds: number): Promise<boolean>;
  /**
   * Attempt to acquire the lock for the given number of seconds.
   * If a callback is provided, it will be executed and the lock released automatically.
   */
  block<T = any>(seconds: number, callback: () => Promise<T> | T): Promise<T>;

  /**
   * Release the lock
   */
  release(): Promise<boolean>;

  /**
   * Returns the current owner of the lock
   */
  owner(): string;

  /**
   * Releases this lock regardless of ownership
   */
  forceRelease(): Promise<boolean>;
}
