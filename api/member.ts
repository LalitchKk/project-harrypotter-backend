import * as bcrypt from "bcrypt";
import express from "express";
import { Response } from "express-serve-static-core";
import { initializeApp } from "firebase/app";
import {
  getStorage
} from "firebase/storage";
import multer from "multer";
import mysql from "mysql";
import config from "../config";
import { conn } from "../dbconnect";
import { MemberPostRequest } from "../model/MemberRequest";
import { giveCurrentDateTime, uploadImage } from "./myConst";

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
    res.json({status:0,member:result});
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

  try {
      var image = await uploadImage(req.file, dateTime);
  } catch (error) {
      return res.json({ message: error, status: 1 });
  }

  const member: MemberPostRequest = req.body;
  const password = member.password;

  // Check if username already exists in the database
  const isUsernameDuplicate = await checkUsernameDuplicate("", member.username);
  if (isUsernameDuplicate) {
      return res.json({
          message: "An account with this username already exists",
          status: 1,
      });
  }

  // Insert new member if username is not duplicate
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
                  return res.json({ message: "Error creating account", status: 1, error: err });
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

      // Use uploadImage function to handle image upload
      try {
          image = await uploadImage(req.file, dateTime);
      } catch (error) {
          console.error("Error uploading image:", error);
          return res.json({ message: "Error uploading image", status: 1 });
      }

      // Fetch image URL from the database if not uploaded
      if (!req.file || !req.file.originalname) {
          conn.query("SELECT image FROM Members WHERE mid = ?", [id], async (err, result) => {
              if (err) {
                  console.error("Database error:", err);
                  return res.json({ message: "Database error", status: 1 });
              }
              if (result.length === 0) {
                  return res.json({ message: "Member not found", status: 1 });
              }
              image = result[0].image;

              // Update member's information in the database if username is not duplicate
              const isUsernameDuplicate = await checkUsernameDuplicate(id, member.username);
              if (!isUsernameDuplicate) {
                  updateMember(id, member, image, res);
              } else {
                  return res.json({ message: "Username already exists", status: 1 });
              }
          });
      } else {
          // If image was uploaded, update member in the database if username is not duplicate
          const isUsernameDuplicate = await checkUsernameDuplicate(id, member.username);
          if (!isUsernameDuplicate) {
              updateMember(id, member, image, res);
          } else {
              return res.json({ message: "Username already exists", status: 1 });
          }
      }
  } catch (error) {
      console.error("Error:", error);
      return res.json({ message: "Server error", status: 1 });
  }
});

// Function to check if the username already exists in the database
async function checkUsernameDuplicate(id: string, username: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
      const sql = "SELECT COUNT(*) AS count FROM Members WHERE username = ? AND mid != ?";
      const values = [username, id];
      conn.query(sql, values, (err, result) => {
          if (err) {
              console.error("Error checking username duplicate:", err);
              reject(err);
          } else {
              const count = result[0].count;
              resolve(count > 0);
          }
      });
  });
}

// Function to update member's information in the database
function updateMember(id: string, member: { username: any; }, image: string, res: Response<any, Record<string, any>, number>) {
  const username = member.username;

  let sql = "UPDATE Members SET username=?, image=? WHERE mid=?";
  sql = mysql.format(sql, [username, image, id]);

  conn.query(sql, (err, result) => {
      if (err) {
          console.error("Error updating account:", err);
          return res.json({ message: "Error updating account", status: 1 });
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