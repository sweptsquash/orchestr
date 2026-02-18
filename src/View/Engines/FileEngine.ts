/**
 * FileEngine - Raw file engine (no template processing)
 *
 * Reads the file from disk and returns its contents as-is.
 * Mirrors Laravel's Illuminate\View\Engines\FileEngine
 */

import { readFileSync } from 'fs';
import type { ViewEngine } from './ViewEngine';

export class FileEngine implements ViewEngine {
  /**
   * Get the evaluated contents of the view.
   * Returns the raw file content without any processing.
   */
  async get(path: string, _data: Record<string, any>): Promise<string> {
    return readFileSync(path, 'utf8');
  }
}
