import express from "express";
import http from "http";
import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import router from "./router";

const PORT = 8080;

const app = express();

app.use(
  cors({
    credentials: true,
  }),
);
app.use(compression());
app.use(bodyParser.json());
app.use("/", router());

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`server is running on http://localhost:${PORT}`);
});
