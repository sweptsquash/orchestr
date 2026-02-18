/**
 * TemplateEngine - Simple template engine
 *
 * Supports a subset of Blade-like directives:
 *   - {{ variable }}        HTML-escaped output
 *   - {!! variable !!}      Raw/unescaped output
 *   - @if / @elseif / @else / @endif
 *   - @foreach / @endforeach
 *   - @include('partial', data?)
 *   - @extends('layout') + @section('name') ... @endsection + @yield('name')
 *
 * Mirrors Laravel's Illuminate\View\Engines\CompilerEngine (simplified)
 */

import { readFileSync } from 'fs';
import type { ViewEngine } from './ViewEngine';

/**
 * Dependency injection shim so the engine can resolve included views
 * without creating a circular import with ViewFactory.
 */
export interface TemplateEngineResolver {
  findView(name: string): string;
}

export class TemplateEngine implements ViewEngine {
  protected resolver: TemplateEngineResolver | null = null;

  /**
   * Set the resolver used for @include / @extends directives.
   */
  setResolver(resolver: TemplateEngineResolver): void {
    this.resolver = resolver;
  }

  /**
   * Get the evaluated contents of the view.
   */
  async get(path: string, data: Record<string, any>): Promise<string> {
    const source = readFileSync(path, 'utf8');
    return this.compile(source, data);
  }

  /**
   * Compile a template string with the given data.
   *
   * Processing order:
   *   1. @extends / @section / @yield  (layout assembly)
   *   2. @include                       (async file inclusion)
   *   3. @if / @elseif / @else / @endif (synchronous)
   *   4. @foreach / @endforeach         (synchronous)
   *   5. {{ expr }}   HTML-escaped
   *   6. {!! expr !!} raw
   */
  async compile(source: string, data: Record<string, any>): Promise<string> {
    // --- Step 1: Layout inheritance (@extends / @section / @yield) ---
    const extendsMatch = source.match(/@extends\(\s*['"]([^'"]+)['"]\s*\)/);

    let assembled: string;
    if (extendsMatch) {
      assembled = await this.compileWithLayout(source, extendsMatch[1], data);
    } else {
      assembled = source;
    }

    // --- Step 2: Expand all @include directives (async, reads files) ---
    const withIncludes = await this.processIncludes(assembled, data);

    // --- Steps 3-6: Synchronous directive processing ---
    return this.processSync(withIncludes, data);
  }

  /**
   * Synchronous directive processing: @if, @foreach, {{ }}, {!! !!}.
   * Called both at the top level and recursively from @foreach bodies.
   */
  private processSync(source: string, data: Record<string, any>): string {
    let output = source;
    output = this.processIf(output, data);
    output = this.processForeach(output, data);
    output = this.processEscapedOutput(output, data);
    output = this.processRawOutput(output, data);
    return output;
  }

  /**
   * Compile a child template that extends a layout.
   */
  private async compileWithLayout(
    childSource: string,
    layoutName: string,
    data: Record<string, any>
  ): Promise<string> {
    // Extract all @section ... @endsection blocks from the child
    const sections = this.extractSections(childSource);

    // Load the layout template
    const layoutPath = this.resolveName(layoutName);
    const layoutSource = readFileSync(layoutPath, 'utf8');

    // Replace @yield('name') / @yield('name', 'default') in the layout
    const output = layoutSource.replace(
      /@yield\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['"]\s*)?\)/g,
      (_match: string, sectionName: string, defaultValue: string = '') => {
        return sections[sectionName] !== undefined ? sections[sectionName] : defaultValue;
      }
    );

    return output;
  }

  /**
   * Extract @section('name') ... @endsection blocks from a template string.
   */
  private extractSections(source: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionRegex = /@section\(\s*['"]([^'"]+)['"]\s*\)([\s\S]*?)@endsection/g;
    let match: RegExpExecArray | null;

    while ((match = sectionRegex.exec(source)) !== null) {
      sections[match[1]] = match[2].trim();
    }

    return sections;
  }

  /**
   * Process @include('view', data?) directives.
   * Each included view is fully compiled (recursively) before insertion.
   */
  private async processIncludes(source: string, data: Record<string, any>): Promise<string> {
    const includeRegex = /@include\(\s*['"]([^'"]+)['"]\s*(?:,\s*(\{[^}]*\}))?\s*\)/g;
    const matches: Array<{ full: string; name: string; extraData: string | undefined }> = [];

    let match: RegExpExecArray | null;
    while ((match = includeRegex.exec(source)) !== null) {
      matches.push({ full: match[0], name: match[1], extraData: match[2] });
    }

    let output = source;

    for (const { full, name, extraData } of matches) {
      let includeData = { ...data };

      if (extraData) {
        try {
          const parsed = this.parseSimpleObject(extraData);
          includeData = { ...includeData, ...parsed };
        } catch {
          // Ignore malformed extra data
        }
      }

      const includePath = this.resolveName(name);
      const includeSource = readFileSync(includePath, 'utf8');
      // Fully compile the included template (handles its own @extends / @include)
      const rendered = await this.compile(includeSource, includeData);
      output = output.replace(full, rendered);
    }

    return output;
  }

  /**
   * Process @if(condition) ... @elseif(condition) ... @else ... @endif blocks.
   *
   * Uses a character-scanning approach to handle nested @if correctly.
   * Recurses until no more @if directives remain.
   */
  private processIf(source: string, data: Record<string, any>): string {
    const ifStart = source.indexOf('@if(');
    if (ifStart === -1) {
      return source;
    }

    // Extract the main @if condition (handles nested parentheses)
    const condStart = ifStart + 4;
    let depth = 1;
    let condEnd = condStart;
    while (condEnd < source.length && depth > 0) {
      if (source[condEnd] === '(') depth++;
      else if (source[condEnd] === ')') depth--;
      if (depth > 0) condEnd++;
    }
    const mainCondition = source.slice(condStart, condEnd);

    // Scan for @elseif / @else / @endif at nesting level 1
    let nesting = 1;
    let pos = condEnd + 1;

    // Each segment: { condition: string (main/elseif) | 'else' | 'if-body', body: string }
    type Segment = { condition: string; body: string };
    const segments: Segment[] = [];
    let segmentStart = condEnd + 1;
    // The first segment uses the main condition
    let pendingCondition: string = mainCondition;

    while (pos < source.length && nesting > 0) {
      if (source.startsWith('@if(', pos)) {
        nesting++;
        pos += 4;
      } else if (source.startsWith('@endif', pos) && (nesting === 1)) {
        // Close the last segment
        segments.push({ condition: pendingCondition, body: source.slice(segmentStart, pos) });
        pos += 6;
        nesting = 0;
        break;
      } else if (source.startsWith('@endif', pos)) {
        nesting--;
        pos++;
      } else if (nesting === 1 && source.startsWith('@elseif(', pos)) {
        // Close current segment
        segments.push({ condition: pendingCondition, body: source.slice(segmentStart, pos) });

        // Extract the @elseif condition
        const elseifCondStart = pos + 8;
        let elseifDepth = 1;
        let elseifCondEnd = elseifCondStart;
        while (elseifCondEnd < source.length && elseifDepth > 0) {
          if (source[elseifCondEnd] === '(') elseifDepth++;
          else if (source[elseifCondEnd] === ')') elseifDepth--;
          if (elseifDepth > 0) elseifCondEnd++;
        }
        pendingCondition = source.slice(elseifCondStart, elseifCondEnd);
        segmentStart = elseifCondEnd + 1;
        pos = elseifCondEnd + 1;
      } else if (nesting === 1 && source.startsWith('@else', pos) && !source.startsWith('@elseif(', pos)) {
        // Close current segment
        segments.push({ condition: pendingCondition, body: source.slice(segmentStart, pos) });
        pendingCondition = '__else__';
        segmentStart = pos + 5;
        pos += 5;
      } else {
        pos++;
      }
    }

    // Evaluate the segments to find the first truthy one
    let replacement = '';
    for (const seg of segments) {
      if (seg.condition === '__else__') {
        replacement = seg.body;
        break;
      }
      try {
        if (this.evaluate(seg.condition, data)) {
          replacement = seg.body;
          break;
        }
      } catch {
        // Evaluation error — treat as falsy
      }
    }

    const before = source.slice(0, ifStart);
    const after = source.slice(pos);
    const result = before + replacement + after;

    // Recurse to process remaining @if blocks
    return this.processIf(result, data);
  }

  /**
   * Process @foreach(items as item) ... @endforeach blocks.
   * Each iteration body is processed synchronously (includes already expanded).
   */
  private processForeach(source: string, data: Record<string, any>): string {
    const foreachRegex = /@foreach\(([^)]+)\s+as\s+(\w+)(?:\s*,\s*(\w+))?\)([\s\S]*?)@endforeach/g;

    return source.replace(
      foreachRegex,
      (_match: string, expr: string, valueVar: string, keyVar: string | undefined, body: string) => {
        let items: any;
        try {
          items = this.evaluate(expr.trim(), data);
        } catch {
          return '';
        }

        if (!items || typeof items !== 'object') {
          return '';
        }

        const entries: Array<[any, any]> = Array.isArray(items)
          ? items.map((v: any, i: number) => [i, v])
          : Object.entries(items);

        return entries
          .map(([key, value]) => {
            const loopData: Record<string, any> = { ...data, [valueVar]: value };
            if (keyVar) {
              loopData[keyVar] = key;
            }
            // Use synchronous processing — includes are already expanded
            return this.processSync(body, loopData);
          })
          .join('');
      }
    );
  }

  /**
   * Process {{ expression }} — HTML-escaped output.
   */
  private processEscapedOutput(source: string, data: Record<string, any>): string {
    return source.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, (_match: string, expr: string) => {
      try {
        const value = this.evaluate(expr.trim(), data);
        return this.escapeHtml(String(value ?? ''));
      } catch {
        return '';
      }
    });
  }

  /**
   * Process {!! expression !!} — raw/unescaped output.
   */
  private processRawOutput(source: string, data: Record<string, any>): string {
    return source.replace(/\{!!\s*([\s\S]+?)\s*!!\}/g, (_match: string, expr: string) => {
      try {
        const value = this.evaluate(expr.trim(), data);
        return String(value ?? '');
      } catch {
        return '';
      }
    });
  }

  /**
   * Safely evaluate a JavaScript expression in the context of the given data.
   */
  private evaluate(expr: string, data: Record<string, any>): any {
    const keys = Object.keys(data);
    const values = Object.values(data);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `return (${expr});`);
    return fn(...values);
  }

  /**
   * Escape HTML special characters to prevent XSS.
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Resolve a dot-notation view name to an absolute file path via the resolver.
   */
  private resolveName(name: string): string {
    if (!this.resolver) {
      throw new Error(
        `TemplateEngine: No resolver set. Cannot resolve view "${name}". ` +
          `Call setResolver() before using @include or @extends.`
      );
    }
    return this.resolver.findView(name);
  }

  /**
   * Parse a simple JSON-like object literal.
   * Handles: { key: 'str' }, { key: "str" }, { key: true/false }, { key: 123 }
   */
  private parseSimpleObject(str: string): Record<string, any> {
    const inner = str.trim().replace(/^\{/, '').replace(/\}$/, '').trim();
    const result: Record<string, any> = {};
    const pairRegex = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|(true|false|\d+(?:\.\d+)?))/g;
    let match: RegExpExecArray | null;

    while ((match = pairRegex.exec(inner)) !== null) {
      const key = match[1];
      const strVal = match[2] ?? match[3];
      const primitiveVal = match[4];

      if (strVal !== undefined) {
        result[key] = strVal;
      } else if (primitiveVal === 'true') {
        result[key] = true;
      } else if (primitiveVal === 'false') {
        result[key] = false;
      } else if (primitiveVal !== undefined) {
        result[key] = Number(primitiveVal);
      }
    }

    return result;
  }
}
