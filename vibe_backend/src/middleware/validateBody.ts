import { zodSchema } from 'ai';
import { AppError } from './errorHandler';
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Generic validation middleware for Express using Zod.
 * @param schema Zod schema to validate against
 * @param property Request property to validate: 'body', 'params', or 'query' (default: 'body')
 */
export function validate(schema: ZodSchema, property: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      const issueCount = result.error.issues.length;
      const firstIssue = result.error.issues[0];
      
      let message = `Validation failed for ${property}`;
      if (issueCount === 1 && firstIssue) {
        message = `${firstIssue.path.join('.') || property}: ${firstIssue.message}`;
      } else if (issueCount > 1) {
        message = `${issueCount} validation errors in ${property}`;
      }
      
      const error = new AppError(
        400,
        message,
        true,
        result.error.issues
      );
      return next(error);
    }
    req[property] = result.data;
    next();
  };
}
