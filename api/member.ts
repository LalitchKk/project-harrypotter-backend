import * as bcrypt from "bcrypt";
import express from "express";
import { Response } from "express-serve-static-core";
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
import { giveCurrentDateTime, imageURL } from "./myConst";

export const router = express.Router();

router.get("/", (req, res) => {
  conn.query("SELECT mid, username, password, status, image, DATE(create_at) AS create_date FROM Members", (err, result, fields) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.json({ message: "Internal server error",status:1 });
    }
    // Modify the response to remove the time part from the create_date field
    result.forEach((entry:any) => {
      entry.create_date = entry.create_date.toISOString().split('T')[0];
    });
    res.json({status:0,picture:result});
  });
});
router.get("/:id", (req, res) => {
  const memberId = req.params.id;
  conn.query("SELECT mid, username, password, status, image, DATE(create_at) AS create_date FROM Members WHERE mid = ?", [memberId], (err, result, fields) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.json({ error: "Internal server error" });
    }
    result.forEach((entry: any) => {
      entry.create_date = entry.create_date.toISOString().split('T')[0];
    });
    res.json({status:0,picture:result});
  });
});


initializeApp(config.firebaseConfig);
const storage = getStorage();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("image"), async (req, res) => {
  const dateTime = giveCurrentDateTime();
  var image=imageURL;

  if (!req.file || !req.file.originalname) {
    imageURL;
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
      return res.json({ message: "Error uploading image", status: 1 });
    }
  }

  const member: MemberPostRequest = req.body;
  const password = member.password;

  conn.query(
    "SELECT COUNT(*) AS count FROM Members WHERE username = ?",
    [member.username],
    (err, result, fields) => {
      if (err) {
        return res.json({ message: "Database error", status: 1 });
      }

      const count = result[0].count;

      if (count > 0) {
        return res.json({
          message: "An account with this username already exists",
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
                return res.json({ message: "Error creating account", status: 1,error:err });
              }
              return res.json({
                message: "Your account has been created!",
                status: 0,
              });
            });
          })
          .catch((err) => {
            console.error("Error generating hash:", err);
            return res.json({ message: "Error generating hash", status: 1 });
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
      return res.json({ message: "Internal server error", status: 1,error:err });
    }

    if (result == null || result.length === 0) {
      // User not found
      return res
        .json({ message: "Username or password is incorrect", status: 1});
    }
    // Compare body password with the hashed password from the database
    bcrypt.compare(password, result[0].password, (bcryptErr, bcryptResult) => {
      if (bcryptErr) {
        console.error(bcryptErr);
        return res.json({ message: "Internal server error", status: 1,error:err });
      }

      if (bcryptResult) {
        // Passwords match, login successful
        return res.json({ message: "Login Success", status: 0 ,member:result }); // Status 0 indicates successful login
      } else {
        // Passwords do not match
        return res
          .json({ message: "Username or password is incorrect", status: 1,error:err });
      }
    });
  });
});

router.delete("/:id", (req, res) => {
  let id = +req.params.id;
  conn.query("delete from Members where mid = ?", [id], (err, result) => {
    if (err) throw err;
    res.json({ affected_row: result.affectedRows,message:"Delete Success",status:0 });
  });
});

router.put("/:id", upload.single("image"), async (req, res) => {
  try {
      const id = req.params.id;
      const member = req.body;
      const dateTime = giveCurrentDateTime();
      let image = "";

      // Check if image was uploaded
      if (req.file && req.file.originalname) {
          const storageRef = ref(
              storage,
              `image/${req.file.originalname + "       " + dateTime}`
          );
          const metadata = { contentType: req.file.mimetype };

          // Upload image to storage
          const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
          image = await getDownloadURL(snapshot.ref);
      } else {
          // Fetch image URL from the database if not uploaded
          conn.query("SELECT image FROM Members WHERE mid = ?", [id], (err, result) => {
              if (err) {
                  console.error("Database error:", err);
                  return res.json({ message: "Database error", status: 1 });
              }
              if (result.length === 0) {
                  return res.json({ message: "Member not found", status: 1 });
              }
              image = result[0].image;

              // Update member's information in the database
              updateMember(id, member, image, res);
          });
      }

      // If image was uploaded, update member in the database
      if (image !== "") {
          updateMember(id, member, image, res);
      }
  } catch (error) {
      console.error("Error:", error);
      return res.json({ message: "Server error", status: 1 });
  }
});

// Function to update member's information in the database
function updateMember(id: string, member: { username: any; }, image: string,res: Response<any, Record<string, any>, number>) {
  const username = member.username;

  let sql = "UPDATE Members SET username=?, image=? WHERE mid=?";
  sql = mysql.format(sql, [username, image, id]);

  conn.query(sql, (err, result) => {
      if (err) {
          console.error("Error updating account:", err);
          return res.json({ message: "Error updating account", status: 1});
      }
      return res.json({
          message: "Your account has been updated!",
          status: 0,
      });
  });
}

router.put("/changePassword/:id", async (req, res) => {
  try {
    const memberId = req.params.id;
    const { oldPassword, newPassword } = req.body; // Extracting old and new passwords from request body

    // Check if the member exists
    conn.query(
      "SELECT * FROM Members WHERE mid = ?",
      [memberId],
      async (err, result, fields) => {
        if (err) {
          return res.json({ message: "Database error", status: 1 });
        }

        if (result.length === 0) {
          return res.json({
            message: "Member not found",
            status: 1,
          });
        }

        try {
          const hashedPasswordFromDB = result[0].password;

          // Compare old password from the request body with hashed password from the database
          const passwordMatch = await bcrypt.compare(oldPassword, hashedPasswordFromDB);

          if (!passwordMatch) {
            return res.json({
              message: "Old password doesn't match",
              status: 1,
            });
          }

          // Hash the new password
          const hashedNewPassword = await bcrypt.hash(newPassword, 10);

          // Update the password in the database
          conn.query(
            "UPDATE Members SET password=? WHERE mid=?",
            [hashedNewPassword, memberId],
            (err, result) => {
              if (err) {
                console.error("Error updating account:", err);
                return res.json({ message: "Error updating account", status: 1 });
              }
              return res.json({
                message: "Your account password has been updated!",
                status: 0,
              });
            }
          );
        } catch (error) {
          console.error("Error:", error);
          return res.json({ message: "Error updating password", status: 1 });
        }
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return res.json({ message: "Server error", status: 1 });
  }
});