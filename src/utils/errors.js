class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large")
    return res.status(413).json({ message: "Request body is too large." });
  if (error instanceof SyntaxError && error.status === 400)
    return res
      .status(400)
      .json({ message: "Request body must contain valid JSON." });
  if (error.name === "ValidationError")
    return res.status(400).json({ message: "Invalid record data." });
  if (error.code === 11000)
    return res
      .status(409)
      .json({ message: "A record with this identifier already exists." });
  if (
    error.name === "MongoServerSelectionError" ||
    error.name === "MongoNetworkError"
  )
    return res
      .status(503)
      .json({ message: "Database unavailable. Please try again later." });
  if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
  if (error.status === 404) return res.status(404).json({ message: 'Resource not found.' });
  res.status(500).json({ message: 'Unable to complete the request. Please try again.' });
}
module.exports = { HttpError, errorHandler };
