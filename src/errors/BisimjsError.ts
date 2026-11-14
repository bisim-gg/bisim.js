import { type ErrorCode, messageFor } from './ErrorCodes.js';

/**
 * An error bisim.js throws itself, with one of the {@link ErrorCodes}.
 */
export interface BisimjsErrorFields {
  /**
   * The error code, one of {@link ErrorCodes}.
   */
  readonly code: ErrorCode;
}

/**
 * The constructor of a {@link BisimjsError} class.
 */
export interface BisimjsErrorConstructor<Base extends Error> {
  new (code: ErrorCode, ...args: unknown[]): Base & BisimjsErrorFields;
  readonly prototype: Base & BisimjsErrorFields;
}

/**
 * Builds an error class that carries one of bisim.js's {@link ErrorCodes}.
 */
function makeBisimjsError<Base extends Error>(BaseClass: new (message?: string) => Base): BisimjsErrorConstructor<Base> {
  const baseName = BaseClass.prototype.name;
  const Parent = BaseClass as unknown as new (message?: string) => Error;
  class BisimjsError extends Parent {
    public readonly code: ErrorCode;

    public constructor(code: ErrorCode, ...args: unknown[]) {
      super(messageFor(code, args));
      this.code = code;
      Object.defineProperty(this, 'name', {
        value: `${baseName} [${code}]`,
        configurable: true,
        writable: true,
        enumerable: false,
      });
      Error.captureStackTrace?.(this, BisimjsError);
    }
  }
  return BisimjsError as unknown as BisimjsErrorConstructor<Base>;
}

/**
 * An error thrown by bisim.js itself (as opposed to an error answered by Bisim's API).
 */
export const BisimjsError = makeBisimjsError(Error);
/**
 * A type error thrown by bisim.js itself.
 */
export const BisimjsTypeError = makeBisimjsError(TypeError);
/**
 * A range error thrown by bisim.js itself.
 */
export const BisimjsRangeError = makeBisimjsError(RangeError);

/**
 * An instance of {@link BisimjsError}.
 */
export type BisimjsError = InstanceType<typeof BisimjsError>;
/**
 * An instance of {@link BisimjsTypeError}.
 */
export type BisimjsTypeError = InstanceType<typeof BisimjsTypeError>;
/**
 * An instance of {@link BisimjsRangeError}.
 */
export type BisimjsRangeError = InstanceType<typeof BisimjsRangeError>;
