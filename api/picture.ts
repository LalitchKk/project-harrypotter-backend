import express from "express";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import multer from "multer";
import mysql from "mysql";
import { conn } from "../dbconnect";
import { giveCurrentDateTime, imageURL } from "./myConst";
const upload = multer(); // Initialize multer without specifying destination
const storage = getStorage();
export const router = express.Router();

router.get("/", (req, res) => {
  conn.query(
    "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date,`mid` FROM `Picture`",
    (err, result, fields) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json(result);
    }
  );
});

router.post("/", upload.single("image"), async (req, res) => {
  const dateTime = giveCurrentDateTime();
  let image = imageURL;

  // Check if image is provided
  if (!req.file || !req.file.originalname) {
      return res.status(400).json({ error: "Image is required", status: 1 });
  } else {
      const storageRef = ref(
          storage,
          `image/${req.file.originalname + "       " + dateTime}`
      );
      const metadata = {
          contentType: req.file.mimetype,
      };

      try {
          const snapshot = await uploadBytesResumable(
              storageRef,
              req.file.buffer,
              metadata
          );

          const downloadURL = await getDownloadURL(snapshot.ref);
          image = downloadURL;
      } catch (error) {
          console.error("Error uploading image:", error);
          return res.status(500).json({ error: "Error uploading image", status: 1 });
      }
  }

  const picture = req.body;
  let sql =
      "INSERT INTO `Picture`(`pic`, `total_votes`, `charac_name`, `create_at`, `mid`)VALUES (?, ?, ?,?, ?)";
  sql = mysql.format(sql, [
      image,
      "0",
      picture.charac_name,
      dateTime,
      picture.mid // Provide the value for the mid column
  ]);
  conn.query(sql, (err, result) => {
      if (err) throw err;
      res
          .status(201)
          .json({ affected_row: result.affectedRows, last_idx: result.insertId ,status:1});
  });
});

  
  router.get("/member/:mid", (req, res) => {
    const memberId = req.params.mid;
    conn.query(
      "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date,`mid` FROM `Picture` WHERE mid = ?",
      memberId,
      (err, result, fields) => {
        if (err) {
          console.error("Error fetching data:", err);
          return res.status(500).json({ error: "Internal server error" });
        }
        res.json(result);
      }
    );
  });