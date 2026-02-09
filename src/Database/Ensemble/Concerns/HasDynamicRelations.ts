/**
 * HasDynamicRelations Concern
 *
 * Provides dynamic relationship access similar to PHP's __get magic method
 * Allows accessing relationships as properties: user.posts instead of user.posts().get()
 */

import { Relation } from '../Relations/Relation';

/**
 * Check if a value is a Relation instance
 */
function isRelation(value: any): boolean {
  return value && value instanceof Relation;
}

/**
 * Create a hybrid function/promise for relationship access
 * This allows both: await user.posts AND user.posts().get()
 */
function createRelationshipProxy(relation: any): any {
  // Create a function that returns the relation when called
  const fn: any = function(...args: any[]) {
    return relation;
  };

  // Make the function thenable (Promise-like) by adding then/catch methods
  fn.then = function(onFulfilled?: any, onRejected?: any) {
    return relation.getResults().then(onFulfilled, onRejected);
  };

  fn.catch = function(onRejected?: any) {
    return relation.getResults().catch(onRejected);
  };

  fn.finally = function(onFinally?: any) {
    return relation.getResults().finally(onFinally);
  };

  return fn;
}

/**
 * Wrap an Ensemble instance with a Proxy that automatically resolves relationships
 */
export function withDynamicRelations<T extends object>(instance: T): T {
  return new Proxy(instance, {
    get(target: any, property: string | symbol, receiver: any): any {
      // Get the original value
      const value = Reflect.get(target, property, receiver);

      // Check if dynamic relations are enabled for this instance
      const dynamicEnabled = target.dynamicRelations === true;

      // If dynamic relations are disabled or it's not a string property, return as-is
      if (!dynamicEnabled || typeof property !== 'string') {
        return value;
      }

      // If it's not a function, return as-is
      if (typeof value !== 'function') {
        return value;
      }

      // Check if this property is a loaded relation
      if (target.relationLoaded && target.relationLoaded(property)) {
        return target.getRelation(property);
      }

      // Try calling the method to see if it returns a Relation
      // We need to be careful here - only call methods that are likely relationships
      // Relationship methods are typically named like nouns (posts, user, comments)
      // and don't take required parameters
      try {
        // Bind the method to the target to maintain context
        const boundMethod = value.bind(target);

        // Get the function's parameter count
        const paramCount = value.length;

        // Only attempt to call if it has no required parameters (all optional)
        if (paramCount === 0) {
          const result = boundMethod();

          // If it returns a Relation, return a hybrid that works both as function and promise
          if (isRelation(result)) {
            return createRelationshipProxy(result);
          }
        }
      } catch (e) {
        // If calling the method fails, just return the original function
        // This handles cases where the method requires parameters
      }

      // Return the original value for non-relationship properties
      return value;
    }
  });
}

/**
 * Mix dynamic relations functionality into a class
 */
export abstract class HasDynamicRelationsMixin {
  /**
   * Enable dynamic relationship access
   * Call this in your model constructor after super()
   */
  protected enableDynamicRelations(): this {
    return withDynamicRelations(this);
  }
}
