import express from "express";
import query from "./query.ts";
const router = express.Router();

export default (): express.Router => {
  query(router);
  return router;
};
