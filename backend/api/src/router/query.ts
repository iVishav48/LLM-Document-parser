import express from "express";
import { query } from "../controllers/query.ts";
import multer from "multer";

const storage = multer.diskStorage({
  filename: function(req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({
  storage,
  limits: {
    fileSize: 1 * 1024 * 1024,
  },
});

export default (router: express.Router) => {
  router.post("/api/v1/query", upload.single("file"), query);
};
