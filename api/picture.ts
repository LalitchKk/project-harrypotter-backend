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

  router.get("/:pid", (req, res) => {
    const pictureId = req.params.pid; 
    conn.query(
        "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` WHERE pid = ?",
        [pictureId], 
        (err, result, fields) => {
            if (err) {
                console.error("Error fetching picture:", err);
                return res.json({ error: "Internal server error",status:1 });
            }

            // Check if the result array is empty (no picture found)
            if (result.length === 0) {
                return res.json({ error: "Picture not found", status: 1 });
            }

            // Picture found, return it
            res.json(result);
        }
    );
});


  router.put("/:id", upload.single("image"), async (req, res) => {
    // Check if image is provided
    if (!req.file || !req.file.originalname) {
        return res.status(400).json({ error: "Image is required", status: 1 });
    } else {
        const storageRef = ref(
            storage,
            `image/${req.file.originalname + "       " }`
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

    var image;
    const picture = req.body;
    const id = req.params.id;
    let sql =
        "UPDATE `Picture` SET `pic`=?,`charac_name`=? WHERE `pid`=?";
    sql = mysql.format(sql, [
        image,
        picture.charac_name,
        id // Use ID from request params
    ]);
    conn.query(sql, (err, result) => {
        if (err) throw err;
        res.status(200).json({ affected_row: result.affectedRows, status: 1 });
    });
});


router.delete("/:id", (req, res) => {
  let id = +req.params.id;
  
  // Check if the picture with the specified ID exists
  conn.query("SELECT * FROM Picture WHERE pid = ?", [id], (err, result) => {
    if (err) {
      console.error("Error checking picture existence:", err);
      return res.status(500).json({ error: "Error checking picture existence", status: 1 });
    }

    // If the picture exists, proceed with deletion; otherwise, return an error
    if (result.length > 0) {
      // Picture exists, proceed with deletion
      conn.query("DELETE FROM Picture WHERE pid = ?", [id], (err, result) => {
        if (err) {
          console.error("Error deleting picture:", err);
          return res.status(500).json({ error: "Error deleting picture", status: 1 });
        }
        res.status(200).json({ affected_row: result.affectedRows,starus:0 });
      });
    } else {
      // Picture not found, return an error response
      res.status(404).json({ error: "Picture not found", status: 1 });
    }
  });
});
