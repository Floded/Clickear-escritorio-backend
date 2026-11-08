export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "HttpError";
    }
}
export class BadRequestError extends HttpError {
    constructor(message = "Solicitud inválida") {
        super(400, message);
    }
}
export class NotFoundError extends HttpError {
    constructor(message = "Recurso no encontrado") {
        super(404, message);
    }
}
export class UnauthorizedError extends HttpError {
    constructor(message = "No autorizado") {
        super(401, message);
    }
}
export class ConflictError extends HttpError {
    constructor(message = "Conflicto con el estado actual del recurso") {
        super(409, message);
    }
}
//# sourceMappingURL=http-error.js.map