import * as authService from '../services/auth.service.js';
import { ok, noContent } from '../utils/apiResponse.js';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '../utils/tokens.js';

function context(req) {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

export async function login(req, res) {
  const { email, password } = req.validated.body;
  const { refreshToken, ...session } = await authService.login({
    email,
    password,
    ...context(req),
  });
  setRefreshCookie(res, refreshToken);
  return ok(res, session);
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  const { refreshToken, ...session } = await authService.refresh({ token, ...context(req) });
  setRefreshCookie(res, refreshToken);
  return ok(res, session);
}

export async function logout(req, res) {
  await authService.logout({
    token: req.cookies?.[REFRESH_COOKIE_NAME],
    userId: req.user?.id,
    ipAddress: req.ip,
  });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
  return noContent(res);
}

export async function me(req, res) {
  return ok(res, await authService.getSession(req.user.id));
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated.body;
  await authService.changePassword({
    userId: req.user.id,
    currentPassword,
    newPassword,
    ipAddress: req.ip,
  });
  // El cambio revoca las sesiones: se limpia la cookie y el cliente vuelve a iniciar sesión.
  res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
  return noContent(res);
}

export async function updateProfile(req, res) {
  return ok(
    res,
    await authService.updateProfile({ userId: req.user.id, data: req.validated.body }),
  );
}
