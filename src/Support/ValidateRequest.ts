/**
 * ValidateRequest Decorator
 *
 * Marks a controller method to enable automatic FormRequest validation.
 * This decorator triggers TypeScript to emit parameter metadata for the method.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserController extends Controller {
 *   @ValidateRequest()
 *   async store(request: StoreUserRequest, res: Response) {
 *     // request is automatically validated
 *   }
 * }
 * ```
 */
export function ValidateRequest(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    // This decorator is intentionally empty.
    // Its sole purpose is to trigger TypeScript's emitDecoratorMetadata
    // feature, which adds reflection metadata about method parameters.
  };
}
