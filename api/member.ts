import * as bcrypt from "bcrypt";
import express from "express";
import { initializeApp } from "firebase/app";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import multer from "multer";
import mysql from "mysql";
import config from "../config";
import { conn } from "../dbconnect";
import { MemberPostRequest } from "../model/MemberRequest";

export const router = express.Router();

router.get("/", (req, res) => {
  conn.query("SELECT mid, username, password, status, image, DATE(create_at) AS create_date FROM Members", (err, result, fields) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    // Modify the response to remove the time part from the create_date field
    result.forEach((entry:any) => {
      entry.create_date = entry.create_date.toISOString().split('T')[0];
    });
    res.json(result);
  });
});
router.get("/:id", (req, res) => {
  const memberId = req.params.id;
  conn.query("SELECT mid, username, password, status, image, DATE(create_at) AS create_date FROM Members WHERE mid = ?", [memberId], (err, result, fields) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    result.forEach((entry: any) => {
      entry.create_date = entry.create_date.toISOString().split('T')[0];
    });
    res.json(result);
  });
});


initializeApp(config.firebaseConfig);
const storage = getStorage();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("image"), async (req, res) => {
  const dateTime = giveCurrentDateTime();
  let image: string | undefined;

  if (!req.file || !req.file.originalname) {
    image = "gs://store-picture.appspot.com/image/default_image.jpg";
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
      return res.json({ error: "Error uploading image", status: 2 });
    }
  }

  const member: MemberPostRequest = req.body;
  const password = member.password;

  conn.query(
    "SELECT COUNT(*) AS count FROM Members WHERE username = ?",
    [member.username],
    (err, result, fields) => {
      if (err) {
        return res.json({ error: "Database error", status: 2 });
      }

      const count = result[0].count;

      if (count > 0) {
        return res.json({
          error: "An account with this username already exists",
          status: 1,
        });
      } else {
        bcrypt
          .hash(password, 10)
          .then((hash) => {
            let sql =
              "INSERT INTO Members (`username`, `password`, `status`, `image`, `create_at`) VALUES (?,?,?,?,?)";
            sql = mysql.format(sql, [
              member.username,
              hash,
              member.status,
              image,
              dateTime,
            ]);

            conn.query(sql, (err, result) => {
              if (err) {
                return res.json({ error: "Error creating account", status: 2 });
              }
              return res.json({
                error: "Your account has been created!",
                status: 0,
              });
            });
          })
          .catch((err) => {
            console.error("Error generating hash:", err);
            return res.json({ error: "Error generating hash", status: 2 });
          });
      }
    }
  );
});


router.post("/login", (req, res) => {
  const { username, password } = req.body;
  let sql = "SELECT * FROM Members WHERE username = ?";
  sql = mysql.format(sql, [username]);

  conn.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (result == null || result.length === 0) {
      // User not found
      return res
        .status(401)
        .json({ error: "Username or password is incorrect", status: 1 });
    }
    // Compare body password with the hashed password from the database
    bcrypt.compare(password, result[0].password, (bcryptErr, bcryptResult) => {
      if (bcryptErr) {
        console.error(bcryptErr);
        return res.status(500).json({ error: "Internal server error" });
      }

      if (bcryptResult) {
        // Passwords match, login successful
        return res.json({ error: "Login Success", status: 0 }); // Status 0 indicates successful login
      } else {
        // Passwords do not match
        return res
          .status(401)
          .json({ error: "Username or password is incorrect", status: 1 });
      }
    });
  });
});

router.delete("/:id", (req, res) => {
  let id = +req.params.id;
  conn.query("delete from Members where mid = ?", [id], (err, result) => {
    if (err) throw err;
    res.status(200).json({ affected_row: result.affectedRows });
  });
});

router.put("/:id", (req, res) => {
  let id = +req.params.id;
  let member: MemberPostRequest = req.body;
  bcrypt.hash(member.password, 10).then((hash) => {
    let sql =
      "update  `Members` set `username`=?, `password`=?, `image`=? where `mid`=?";
    sql = mysql.format(sql, [member.username, hash, member.image, id]);
    conn.query(sql, (err, result) => {
      if (err) throw err;
      res.status(201).json({ affected_row: result.affectedRows });
    });
  });
});

const giveCurrentDateTime = () => {
  const today = new Date();
  const date =
    today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  return date;
};
