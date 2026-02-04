/**
 * HasRelationships Concern
 *
 * Provides relationship functionality to Ensemble models
 */

import { Ensemble } from '../Ensemble';
import { EnsembleBuilder } from '../EnsembleBuilder';
import { Relation } from '../Relations/Relation';
import { HasOne } from '../Relations/HasOne';
import { HasMany } from '../Relations/HasMany';
import { BelongsTo } from '../Relations/BelongsTo';

export interface RelationshipConfig {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany' | 'hasOneThrough' | 'hasManyThrough' | 'morphTo' | 'morphMany' | 'morphOne' | 'morphToMany' | 'morphedByMany';
  related: string;
  foreignKey?: string;
  localKey?: string;
  relation?: string;
}

export abstract class HasRelationshipsMixin {
  /**
   * The loaded relationships for the model
   */
  protected relations: Record<string, any> = {};

  /**
   * Define a one-to-one relationship
   */
  protected hasOne<TRelated extends Ensemble>(
    related: new () => TRelated,
    foreignKey?: string,
    localKey?: string
  ): HasOne<TRelated, any> {
    const instance = new related();

    const finalForeignKey = foreignKey || this.getForeignKey();
    const finalLocalKey = localKey || (this as any).getKeyName();

    return new HasOne<TRelated, any>(
      instance.newQuery() as EnsembleBuilder<TRelated>,
      this as any,
      finalForeignKey,
      finalLocalKey
    );
  }

  /**
   * Define a one-to-many relationship
   */
  protected hasMany<TRelated extends Ensemble>(
    related: new () => TRelated,
    foreignKey?: string,
    localKey?: string
  ): HasMany<TRelated, any> {
    const instance = new related();

    const finalForeignKey = foreignKey || this.getForeignKey();
    const finalLocalKey = localKey || (this as any).getKeyName();

    return new HasMany<TRelated, any>(
      instance.newQuery() as EnsembleBuilder<TRelated>,
      this as any,
      finalForeignKey,
      finalLocalKey
    );
  }

  /**
   * Define an inverse one-to-one or many relationship
   */
  protected belongsTo<TRelated extends Ensemble>(
    related: new () => TRelated,
    foreignKey?: string,
    ownerKey?: string,
    relation?: string
  ): BelongsTo<TRelated, any> {
    const instance = new related();
    const relationName = relation || this.snake(instance.constructor.name);

    if (!foreignKey) {
      foreignKey = this.snake(relationName) + '_' + instance.getKeyName();
    }

    const finalOwnerKey = ownerKey || instance.getKeyName();

    return new BelongsTo<TRelated, any>(
      instance.newQuery() as EnsembleBuilder<TRelated>,
      this as any,
      foreignKey,
      finalOwnerKey,
      relationName
    );
  }

  /**
   * Get the default foreign key name for the model
   */
  protected getForeignKey(): string {
    return this.snake((this as any).constructor.name) + '_' + (this as any).getKeyName();
  }

  /**
   * Get a relationship value from a method
   */
  protected getRelationshipFromMethod(method: string): any {
    const relation = (this as any)[method]();

    if (!(relation instanceof Relation)) {
      throw new Error(
        `Relationship method must return an object of type Relation (${method})`
      );
    }

    return relation;
  }

  /**
   * Get a relationship instance by name
   */
  public getRelation(relation: string): any {
    return this.relations[relation];
  }

  /**
   * Set the given relationship on the model
   */
  public setRelation(relation: string, value: any): this {
    this.relations[relation] = value;
    return this as any;
  }

  /**
   * Unset a loaded relationship
   */
  public unsetRelation(relation: string): this {
    delete this.relations[relation];
    return this as any;
  }

  /**
   * Get all the loaded relations for the instance
   */
  public getRelations(): Record<string, any> {
    return this.relations;
  }

  /**
   * Set the entire relations array on the model
   */
  public setRelations(relations: Record<string, any>): this {
    this.relations = relations;
    return this as any;
  }

  /**
   * Determine if the given relation is loaded
   */
  public relationLoaded(key: string): boolean {
    return key in this.relations;
  }

  /**
   * Load a relationship if it hasn't been loaded yet
   */
  public async load(relations: string | string[]): Promise<this> {
    const relationArray = Array.isArray(relations) ? relations : [relations];

    for (const relation of relationArray) {
      if (!this.relationLoaded(relation)) {
        const results = await this.getRelationshipFromMethod(relation).getResults();
        this.setRelation(relation, results);
      }
    }

    return this as any;
  }

  /**
   * Eager load relations on the model
   */
  public async loadMissing(relations: string | string[]): Promise<this> {
    const relationArray = Array.isArray(relations) ? relations : [relations];
    const missing = relationArray.filter(relation => !this.relationLoaded(relation));

    if (missing.length > 0) {
      await this.load(missing);
    }

    return this as any;
  }

  /**
   * Touch the owning relations of the model
   */
  public async touch(): Promise<boolean> {
    // TODO: Implement when we have timestamps
    return true;
  }

  /**
   * Create a new model query instance for the model
   */
  protected abstract newQuery(): EnsembleBuilder<any>;

  /**
   * Get the table name (from Ensemble)
   */
  protected abstract getTable(): string;

  /**
   * Get the primary key name (from Ensemble)
   */
  protected abstract getKeyName(): string;

  /**
   * Convert a string to snake case
   */
  protected snake(value: string): string {
    return value
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}
