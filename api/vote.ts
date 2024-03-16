// import express from "express";
// import {
//   getDownloadURL,
//   getStorage,
//   ref,
//   uploadBytesResumable,
// } from "firebase/storage";
// import multer from "multer";
// import mysql from "mysql";
// import { conn } from "../dbconnect";
// import { giveCurrentDateTime, imageURL } from "./myConst";
// const upload = multer(); 
// const storage = getStorage();
// export const router = express.Router();

// router.get("/", (req, res) => {
//   conn.query(
//     "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Votes`",
//     (err, result, fields) => {
//       if (err) {
//         console.error("Error fetching data:", err);
//         return res.json({ error: "Internal server error" });
//       }
//       res.json({status:0,picture:result});
//     }
//   );
// });