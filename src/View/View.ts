/**
 * View - Represents a renderable view with its data.
 *
 * Mirrors Laravel's Illuminate\View\View
 */

import type { ViewEngine } from './Engines/ViewEngine';

export class View {
  protected viewPath: string;
  protected viewName: string;
  protected viewData: Record<string, any>;
  protected engine: ViewEngine;

  constructor(engine: ViewEngine, name: string, path: string, data: Record<string, any> = {}) {
    this.engine = engine;
    this.viewName = name;
    this.viewPath = path;
    this.viewData = data;
  }

  /**
   * Add a piece of data to the view.
   * Laravel: $view->with('key', 'value') or $view->with(['key' => 'value'])
   */
  with(key: string | Record<string, any>, value?: any): this {
    if (typeof key === 'string') {
      this.viewData[key] = value;
    } else {
      Object.assign(this.viewData, key);
    }

    return this;
  }

  /**
   * Render the view to an HTML string.
   */
  async render(): Promise<string> {
    return this.engine.get(this.viewPath, this.viewData);
  }

  /**
   * Get the name of the view.
   */
  name(): string {
    return this.viewName;
  }

  /**
   * Get the array of view data.
   */
  getData(): Record<string, any> {
    return this.viewData;
  }

  /**
   * Get the path to the view file.
   */
  getPath(): string {
    return this.viewPath;
  }

  /**
   * Alias for render() — allows using the View as an HTML string source.
   */
  async toHtml(): Promise<string> {
    return this.render();
  }

  /**
   * Allow string coercion (synchronous) — returns the view name for debugging.
   * For the actual HTML, always await render().
   */
  toString(): string {
    return `[View: ${this.viewName}]`;
  }
}
