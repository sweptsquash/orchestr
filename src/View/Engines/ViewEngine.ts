/**
 * ViewEngine - Contract for template engines
 *
 * Mirrors Laravel's Illuminate\View\Engines\EngineInterface
 */

export interface ViewEngine {
  /**
   * Get the evaluated contents of the view.
   */
  get(path: string, data: Record<string, any>): Promise<string>;
}
