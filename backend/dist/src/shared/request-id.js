export const requestIdMiddleware = (req, _res, next) => {
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`;
    req.headers["x-request-id"] = requestId;
    next();
};
//# sourceMappingURL=request-id.js.map