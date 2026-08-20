import { randomUUID } from "crypto";
import { RequestHandler } from "express";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const supplied = req.header("x-request-id");
  const id = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();

  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
};
