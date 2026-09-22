// Valida body, params y query con esquemas Zod y deja el resultado en req.validated.
// En Express 5 req.query es de solo lectura, por eso no se sobrescribe.
import { ApiError } from '../utils/ApiError.js';

/**
 * @param {{ body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const issues = [];

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (result.success) {
        validated[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ field: issue.path.join('.') || part, message: issue.message, in: part });
        }
      }
    }

    if (issues.length > 0) return next(ApiError.validation(issues));
    req.validated = { ...req.validated, ...validated };
    next();
  };
}
