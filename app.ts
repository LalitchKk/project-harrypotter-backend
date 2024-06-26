import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import { router as index } from "./api/index";
import { router as member } from "./api/member";
import { router as picture } from "./api/picture";
import { router as setting } from "./api/setting";
import { router as vote } from "./api/vote";

export const app = express();

app.use(
    cors({
      origin: "*",
    })
  );
  app.use(bodyParser.text());
app.use(bodyParser.json());
app.use("/", index);
app.use("/member", member);
app.use("/picture", picture);
app.use("/vote", vote);
app.use("/setting", setting);

// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });