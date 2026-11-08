export const requestIdMiddleware = (
  req: import("express").Request,
  _res: import("express").Response,
  next: import("express").NextFunction
): void => {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`;
  req.headers["x-request-id"] = requestId;
  next();
};