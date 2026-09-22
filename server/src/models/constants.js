// Valores de dominio. Deben coincidir con las CHECK constraints de la base (docs/database.md).

export const LEAD_STATUS = Object.freeze({
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  UNQUALIFIED: 'UNQUALIFIED',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
});
export const LEAD_STATUSES = Object.values(LEAD_STATUS);

/** Transiciones de estado permitidas para leads (docs/requirements.md § 6.2). */
export const LEAD_TRANSITIONS = Object.freeze({
  NEW: ['CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'UNQUALIFIED', 'LOST'],
  QUALIFIED: ['UNQUALIFIED', 'LOST'],
  UNQUALIFIED: ['NEW'],
  LOST: ['NEW'],
  CONVERTED: [],
});
export const LEAD_CONVERTIBLE_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED'];

export const CLIENT_TYPE = Object.freeze({ COMPANY: 'COMPANY', INDIVIDUAL: 'INDIVIDUAL' });
export const CLIENT_TYPES = Object.values(CLIENT_TYPE);

export const CLIENT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  CHURNED: 'CHURNED',
});
export const CLIENT_STATUSES = Object.values(CLIENT_STATUS);

export const ACTIVITY_TYPE = Object.freeze({
  CALL: 'CALL',
  EMAIL: 'EMAIL',
  MEETING: 'MEETING',
  TASK: 'TASK',
  FOLLOW_UP: 'FOLLOW_UP',
});
export const ACTIVITY_TYPES = Object.values(ACTIVITY_TYPE);
export const ACTIVITY_TYPES_REQUIRING_DUE_DATE = ['TASK', 'FOLLOW_UP'];

export const ACTIVITY_STATUS = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});
export const ACTIVITY_STATUSES = Object.values(ACTIVITY_STATUS);
export const ACTIVITY_OPEN_STATUSES = ['PENDING', 'IN_PROGRESS'];

export const ACTIVITY_PRIORITY = Object.freeze({ LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' });
export const ACTIVITY_PRIORITIES = Object.values(ACTIVITY_PRIORITY);

export const EMPLOYEES_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

export const AUDIT_ACTION = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  STAGE_CHANGE: 'STAGE_CHANGE',
  ASSIGN: 'ASSIGN',
  CONVERT: 'CONVERT',
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  ROLE_CHANGE: 'ROLE_CHANGE',
});
export const AUDIT_ACTIONS = Object.values(AUDIT_ACTION);

export const NOTIFICATION_TYPE = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  ACTIVITY_DUE: 'ACTIVITY_DUE',
  ACTIVITY_OVERDUE: 'ACTIVITY_OVERDUE',
  LEAD_CONVERTED: 'LEAD_CONVERTED',
  OPPORTUNITY_WON: 'OPPORTUNITY_WON',
  OPPORTUNITY_LOST: 'OPPORTUNITY_LOST',
});

export const SYSTEM_ROLES = Object.freeze({
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES: 'Vendedor',
});

export const SETTING_KEYS = ['company_name', 'default_currency', 'timezone', 'date_format'];
