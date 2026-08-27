import crypto from 'crypto';

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-]{8,64}$/;

/**
 * Middleware to assign or propagate a unique request correlation ID.
 * Attaches req.id and returns X-Request-Id header.
 */
export const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];

  let requestId;
  if (incomingId && typeof incomingId === 'string' && SAFE_REQUEST_ID_REGEX.test(incomingId.trim())) {
    requestId = incomingId.trim();
  } else {
    requestId = crypto.randomUUID();
  }

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};
