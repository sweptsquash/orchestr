# Orchestr

A Laravel-inspired ORM and framework for TypeScript. Write elegant backend applications with ActiveRecord models (called Ensembles), relationships, query building, and more.

## Installation

```bash
npm install @orchestr-sh/orchestr reflect-metadata drizzle-orm
npm install better-sqlite3 # or your preferred database driver
```

## Quick Start

```typescript
import 'reflect-metadata';
import { Application, Kernel, ConfigServiceProvider, Route } from '@orchestr-sh/orchestr';

const app = new Application(process.cwd());

// Configure database
app.register(new ConfigServiceProvider(app, {
  database: {
    default: 'sqlite',
    connections: {
      sqlite: {
        adapter: 'drizzle',
        driver: 'sqlite',
        database: './database.db',
      },
    },
  },
}));

await app.boot();

// Define routes
Route.get('/', async (req, res) => {
  return res.json({ message: 'Welcome to Orchestr!' });
});

// Start server
const kernel = new Kernel(app);
kernel.listen(3000);
```

## Models (Ensembles)

Ensembles are ActiveRecord models with a fluent API for querying and relationships.

```typescript
import { Ensemble } from '@orchestr-sh/orchestr';

export class User extends Ensemble {
  protected table = 'users';
  protected fillable = ['name', 'email', 'password'];
  protected hidden = ['password'];
}

// Query
const users = await User.query().where('active', true).get();
const user = await User.find(1);

// Create
const user = await User.create({ name: 'John', email: 'john@example.com' });

// Update
user.name = 'Jane';
await user.save();

// Delete
await user.delete();
```

## Querying

Fluent query builder with chainable methods.

```typescript
import { DB } from '@orchestr-sh/orchestr';

// Query builder
const users = await DB.table('users')
  .where('votes', '>', 100)
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

// Using models
const posts = await Post.query()
  .where('published', true)
  .with('author')
  .get();

// Aggregates
const count = await Post.query().count();
const avg = await Post.query().avg('views');
```

## Relationships

### Standard Relationships

```typescript
import { Ensemble, HasMany, BelongsTo, DynamicRelation } from '@orchestr-sh/orchestr';

export class User extends Ensemble {
  protected table = 'users';

  @DynamicRelation
  posts(): HasMany<Post, User> {
    return this.hasMany(Post);
  }
}

export class Post extends Ensemble {
  protected table = 'posts';

  @DynamicRelation
  user(): BelongsTo<User, this> {
    return this.belongsTo(User);
  }
}

// Use relationships
const user = await User.find(1);
const posts = await user.posts().get(); // Query builder
const posts = await user.posts; // Direct access (via @DynamicRelation)

// Eager loading
const users = await User.query().with('posts').get();

// Nested eager loading
const posts = await Post.query().with('user.posts').get();
```

### Many-to-Many

```typescript
import { Ensemble, BelongsToMany, DynamicRelation } from '@orchestr-sh/orchestr';

export class User extends Ensemble {
  @DynamicRelation
  roles(): BelongsToMany<Role, User> {
    return this.belongsToMany(Role, 'role_user')
      .withPivot('expires_at')
      .withTimestamps();
  }
}

// Attach/Detach
await user.roles().attach([1, 2, 3]);
await user.roles().detach([1]);

// Sync (detach all, attach new)
await user.roles().sync([1, 2, 3]);

// Query pivot
const activeRoles = await user.roles()
  .wherePivot('expires_at', '>', new Date())
  .get();
```

### Polymorphic Relationships

```typescript
import { Ensemble, MorphMany, MorphTo, DynamicRelation } from '@orchestr-sh/orchestr';

export class Post extends Ensemble {
  @DynamicRelation
  comments(): MorphMany<Comment, Post> {
    return this.morphMany(Comment, 'commentable');
  }
}

export class Video extends Ensemble {
  @DynamicRelation
  comments(): MorphMany<Comment, Video> {
    return this.morphMany(Comment, 'commentable');
  }
}

export class Comment extends Ensemble {
  @DynamicRelation
  commentable(): MorphTo<Post | Video> {
    return this.morphTo('commentable');
  }
}

// Use polymorphic relations
const post = await Post.find(1);
const comments = await post.comments;

const comment = await Comment.find(1);
const parent = await comment.commentable; // Returns Post or Video
```

## @DynamicRelation Decorator

The `@DynamicRelation` decorator enables dual-mode access to relationships:

```typescript
export class User extends Ensemble {
  @DynamicRelation
  posts(): HasMany<Post, User> {
    return this.hasMany(Post);
  }
}

const user = await User.find(1);

// Method syntax (returns query builder)
const query = user.posts();
const recentPosts = await query.where('created_at', '>', yesterday).get();

// Property syntax (returns results directly)
const allPosts = await user.posts;
```

Without `@DynamicRelation`, you must always call the method: `user.posts().get()`.

## Controllers

```typescript
import { Controller, Injectable, ValidateRequest } from '@orchestr-sh/orchestr';

@Injectable()
export class UserController extends Controller {
  constructor(private service: UserService) {
    super();
  }

  @ValidateRequest()
  async index(req: GetUsersRequest, res: any) {
    const users = await User.query().with('posts').get();
    return res.json({ data: users });
  }

  async show(req: any, res: any) {
    const user = await User.find(req.routeParam('id'));
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json({ data: user });
  }
}

// Register route
Route.get('/users', [UserController, 'index']);
Route.get('/users/:id', [UserController, 'show']);
```

## FormRequest Validation

```typescript
import { FormRequest, ValidationRules } from '@orchestr-sh/orchestr';

export class StoreUserRequest extends FormRequest {
  protected authorize(): boolean {
    return true; // Add authorization logic
  }

  protected rules(): ValidationRules {
    return {
      name: 'required|string|min:3',
      email: 'required|email',
      password: 'required|min:8',
    };
  }
}

// Use with @ValidateRequest decorator
@Injectable()
export class UserController extends Controller {
  @ValidateRequest()
  async store(req: StoreUserRequest, res: any) {
    const validated = req.validated();
    const user = await User.create(validated);
    return res.status(201).json({ data: user });
  }
}
```

## Configuration

### Database Setup

```typescript
import { DatabaseServiceProvider, DatabaseManager, DrizzleAdapter } from '@orchestr-sh/orchestr';

export class DatabaseServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('db', () => {
      const config = this.app.make('config').get('database');
      const manager = new DatabaseManager(config);
      manager.registerAdapter('drizzle', (config) => new DrizzleAdapter(config));
      return manager;
    });
  }

  async boot(): Promise<void> {
    const db = this.app.make('db');
    await db.connection().connect();
    Ensemble.setConnectionResolver(db);
  }
}

// Register in your app
app.register(DatabaseServiceProvider);
```

### Service Providers

```typescript
import { ServiceProvider } from '@orchestr-sh/orchestr';

export class AppServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('myService', () => new MyService());
  }

  async boot(): Promise<void> {
    // Bootstrap code
  }
}
```

## API Reference

### Ensemble Methods

```typescript
// Query
User.query()              // Get query builder
User.find(id)             // Find by primary key
User.findOrFail(id)       // Find or throw error
User.all()                // Get all records
User.create(data)         // Create and save

// Instance methods
user.save()               // Save changes
user.delete()             // Delete record
user.refresh()            // Reload from database
user.load('posts')        // Lazy load relationship
user.toObject()           // Convert to plain object
```

### Query Builder Methods

```typescript
.where(column, value)
.where(column, operator, value)
.orWhere(column, value)
.whereIn(column, array)
.whereBetween(column, [min, max])
.whereNull(column)
.orderBy(column, direction)
.limit(number)
.offset(number)
.join(table, first, operator, second)
.groupBy(column)
.having(column, operator, value)
.select(columns)
.count()
.sum(column)
.avg(column)
.min(column)
.max(column)
```

### Relationship Methods

```typescript
// HasOne, HasMany, BelongsTo
.get()                    // Execute query
.first()                  // Get first result
.create(data)             // Create related model
.where(column, value)     // Add constraint

// BelongsToMany
.attach(ids)              // Attach related models
.detach(ids)              // Detach related models
.sync(ids)                // Sync relationships
.toggle(ids)              // Toggle relationships
.wherePivot(column, value) // Query pivot table
.updateExistingPivot(id, data) // Update pivot data

// All relationships
.with('relation')         // Eager load
.with(['relation1', 'relation2'])
.with({ relation: (q) => q.where(...) })
```

### Available Relationships

- `HasOne` - One-to-one
- `HasMany` - One-to-many
- `BelongsTo` - Inverse of HasOne/HasMany
- `BelongsToMany` - Many-to-many
- `MorphOne` - Polymorphic one-to-one
- `MorphMany` - Polymorphic one-to-many
- `MorphTo` - Inverse of MorphOne/MorphMany
- `MorphToMany` - Polymorphic many-to-many
- `MorphedByMany` - Inverse of MorphToMany

## Features

- ✅ Service Container & Dependency Injection
- ✅ Configuration System
- ✅ HTTP Router & Middleware
- ✅ Controllers with DI
- ✅ FormRequest Validation
- ✅ Query Builder
- ✅ Ensemble ORM (ActiveRecord)
- ✅ Relationships (Standard + Polymorphic)
- ✅ Eager/Lazy Loading
- ✅ Soft Deletes
- ✅ Attribute Casting
- ✅ Timestamps
- ✅ @DynamicRelation Decorator

## License

MIT

---

Built with TypeScript. Inspired by Laravel.
