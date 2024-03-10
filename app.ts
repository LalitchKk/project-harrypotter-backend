import bodyParser from "body-parser";
import express from "express";
import { router as index } from "./api/index";

export const app = express();

app.use(bodyParser.text());
app.use(bodyParser.json());
app.use("/", index);
// app.use("/member", member);
// app.use("/", (req, res) => {
//   res.send("Hello World!!!");
// });