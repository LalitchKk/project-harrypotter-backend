import * as bcrypt from "bcrypt";
import express from "express";
import mysql from "mysql";
import { conn } from "../dbconnect";
import { MemberPostRequest } from "../model/MemberRequest";

export const router = express.Router();

router.get("/", (req, res) => {
  conn.query("SELECT * FROM Members", (err, result, fields) => {
    res.json(result);
  });
});

router.post("/", (req, res) => {
  const currentDate: Date = new Date();
  const formattedDate: string = currentDate.toISOString().slice(0, 10);
  let member: MemberPostRequest = req.body;
  let password = member.password;

  conn.query(
    "SELECT * FROM Members where username = ?",[member.username],
    (err, result, fields) => {
      if (result != null) {
        bcrypt
          .hash(password, 10)
          .then((hash) => {
            let sql =
              "INSERT INTO Members (`username`, `password`, `status`, `image`, `create_at`) VALUES (?,?,?,?,?)";
            sql = mysql.format(sql, [
              member.username,
              hash,
              member.status,
              member.image,
              formattedDate,
            ]);

            conn.query(sql, (err, result) => {
              if (err) throw err;
              return res.json({ error: "Your account has been created!", status: 0 });
            });
          })
          .catch((err) => console.error("Error generating hash:", err));
      } else {
        return res.json({ error: "Already have account", status: 1 });
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
        return res.json({ error: "Login Success",status: 0 }); // Status 0 indicates successful login
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
