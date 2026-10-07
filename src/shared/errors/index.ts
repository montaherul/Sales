// Domain and Application Error Hierarchy
// Afaz Tobacco Sales & Stock Intelligence Platform

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', isOperational: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied: insufficient permissions or scope mismatch') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(id ? `${entity} with ID '${id}' not found` : `${entity} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  public readonly details?: any;

  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class StateTransitionError extends AppError {
  constructor(currentStatus: string, attemptedAction: string, allowedRoles: string[]) {
    super(
      `Cannot transition from '${currentStatus}' with action '${attemptedAction}'. Requires roles: [${allowedRoles.join(', ')}]`,
      422,
      'INVALID_STATE_TRANSITION'
    );
  }
}

export class DateMismatchError extends AppError {
  constructor(filenameDate: string, fileDataDate: string, userSelectedDate: string) {
    super(
      `Date mismatch detected! Filename date: '${filenameDate}', Sheet date: '${fileDataDate}', Selected date: '${userSelectedDate}'. Import aborted.`,
      422,
      'DATE_MISMATCH'
    );
  }
}
