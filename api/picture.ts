import express from "express";
import multer from "multer";
import mysql from "mysql";
import { conn } from "../dbconnect";
import { giveCurrentDateTime, uploadImage } from "./myConst";
const upload = multer(); 
export const router = express.Router();

router.get("/", (req, res) => {
  conn.query(
    "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` ORDER BY `total_votes` DESC LIMIT 10",
    (err, result, fields) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.json({ error: "Internal server error" });
      }
      res.json({status:0,picture:result});
    }
  );
});

router.post("/", upload.single("image"), async (req, res) => {
  const dateTime = giveCurrentDateTime();

  try {
      var image = await uploadImage(req.file, dateTime);
  } catch (error) {
      return res.json({ message: error, status: 1 });
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
          
          .json({ affected_row: result.affectedRows, last_idx: result.insertId ,status:1});
  });
});

  
  router.get("/member/:mid", (req, res) => {
    const memberId = req.params.mid;
    conn.query(
      "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` WHERE `mid` = ? ORDER BY `total_votes` DESC",
      memberId,
      (err, result, fields) => {
        if (err) {
          console.error("Error fetching data:", err);
          return res.json({ message: "Internal server error",status:1 });
        }
        res.json({status:0,picture:result});
        
      }
    );
  });

  router.get("/pid/:pid", (req, res) => {
    const pictureId = req.params.pid; 
    conn.query(
        "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` WHERE pid = ?",
        [pictureId], 
        (err, result, fields) => {
            if (err) {
                console.error("Error fetching picture:", err);
                return res.json({ message: "Internal server error",status:1 });
            }

            // Check if the result array is empty (no picture found)
            if (result.length === 0) {
                return res.json({ message: "Picture not found", status: 1 });
            }

            // Picture found, return it
            res.json({status:0,picture:result});
        }
    );
});


router.put("/:id", upload.single("image"), async (req, res) => {
  try {
      // Check if image not have
      if (!req.file || !req.file.originalname) {
          return res.json({ message: "Image is required", status: 1 });
      }

      // Upload image and get download URL
      const dateTime = giveCurrentDateTime();
      let image = "";
      try {
          image = await uploadImage(req.file, dateTime);
      } catch (error) {
          console.error("Error uploading image:", error);
          return res.json({ message: "Error uploading image", status: 1 });
      }

      const picture = req.body;
      const id = req.params.id;

      // Update picture  in  database
      let sql =
          "UPDATE `Picture` SET `pic`=?,`charac_name`=? WHERE `pid`=?";
      sql = mysql.format(sql, [image, picture.charac_name, id]);

      conn.query(sql, (err, result) => {
          if (err) {
              console.error("Error updating picture:", err);
              return res.json({ message: "Error updating picture", status: 1 });
          }
          res.json({ affected_row: result.affectedRows, status: 0 });
      });
  } catch (error) {
      console.error("Error:", error);
      return res.json({ message: "Server error", status: 1 });
  }
});


router.delete("/:id", (req, res) => {
  let id = +req.params.id;
  
  // Check if the picture with the specified ID exists
  conn.query("SELECT * FROM Picture WHERE pid = ?", [id], (err, result) => {
    if (err) {
      console.error("Error checking picture existence:", err);
      return res.json({ message: "Error checking picture existence", status: 1 });
    }

    // If the picture exists, proceed with deletion; otherwise, return an error
    if (result.length > 0) {
      // Picture exists, proceed with deletion
      conn.query("DELETE FROM Picture WHERE pid = ?", [id], (err, result) => {
        if (err) {
          console.error("Error deleting picture:", err);
          return res.status(500).json({ message: "Error deleting picture", status: 1 });
        }
        res.json({message:"Delete Success", affected_row: result.affectedRows,starus:0 });
      });
    } else {
      // Picture not found, return an error response
      res.json({ message: "Picture not found", status: 1 });
    }
  });
});

router.get("/random", (req, res) => {
  conn.query(
    "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` ORDER BY RAND() LIMIT 2",
    (err, result, fields) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.json({ message: "Internal server error" });
      }
      res.json({status:0,picture:result});
    }
  );
});

router.get("/u", (req, res) => {
  conn.query(
    "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` CROSS JOIN (SELECT MIN(total_votes) AS min_votes, MAX(total_votes) AS max_votes FROM `Picture`) AS range_votes ORDER BY ABS(total_votes - ROUND(range_votes.min_votes + (RAND() * (range_votes.max_votes - range_votes.min_votes)))), RAND()) LIMIT 2",
    (err, result, fields) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.json({ message: "Internal server error" ,status:1});
      }
      res.json({status:0,picture:result});
    }
  );
});


