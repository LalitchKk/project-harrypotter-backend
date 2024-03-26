import express from "express";
import mysql from "mysql";
import { conn } from "../dbconnect";
export const router = express.Router();

router.get("/", (req, res) => {
  conn.query("SELECT secid,  second FROM Setting", (err, result, fields) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.json({ message: "Internal server error", status: 1 });
    }
    // Modify the response to remove the time part from the create_date field
    result.forEach((entry: any) => {
      if (entry.create_date) {
        // Check if create_date is defined
        entry.create_date = new Date(entry.create_date)
          .toISOString()
          .split("T")[0];
      }
    });
    res.json({ status: 0, time: result });
  });
});

router.put("/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const time = req.body;
  
      let sql = "UPDATE Setting SET second = ? WHERE secid=?";
      sql = mysql.format(sql, [time.second, id]);
    
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
  
    } catch (error) {
      console.error("Error:", error);
      return res.json({ message: "Server error", status: 1 });
    }
  });
  
