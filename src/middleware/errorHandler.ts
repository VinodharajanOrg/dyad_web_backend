import { Request, Response, NextFunction } from 'express';
import { ZodIssue } from 'zod';

export class AppError extends Error {
  public validationErrors?: ZodIssue[];
  
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    validationErrors?: ZodIssue[]
  ) {
    super(message);
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    const response: any = {
      error: err.message
    };

    // Format validation errors in a clean, readable way
    if (err.validationErrors && err.validationErrors.length > 0) {
      response.validationErrors = err.validationErrors.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        expected: 'expected' in issue ? issue.expected : undefined,
        received: 'received' in issue ? issue.received : undefined
      }));
    }

    // Only include stack in development and if no validation errors (to keep response clean)
    if (process.env.NODE_ENV === 'development' && !err.validationErrors) {
      response.stack = err.stack;
    }

    return res.status(err.statusCode).json(response);
  }

  // Default error
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      message: err.message,
      stack: err.stack 
    })
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
