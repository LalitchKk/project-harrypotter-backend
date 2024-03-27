import express from "express";
import multer from "multer";
import mysql from "mysql";
import { conn } from "../dbconnect";
import { giveCurrentDateTime, uploadImage } from "./myConst";
const upload = multer();
export const router = express.Router();

router.get("/", (req, res) => {
  const yesterdayList: any[] = []; // เก็บผลลัพธ์ query ที่ดึงข้อมูลเมื่อวานมาเก็บไว้
  const todayList: any[] = []; // เก็บผลลัพธ์ query ที่ดึงข้อมูลวันนี้มาเก็บไว้
  const yesterdayRank: number[] = []; // เก็บ rank ของรูปภาพจากเมื่อวาน

  // Query สำหรับเก็บข้อมูลเมื่อวาน
  const yesterdaySql =
    "SELECT p.pid, p.pic, p.total_votes, p.charac_name, DATE_FORMAT(p.create_at, '%Y-%m-%d') AS create_date, p.mid, " +
    "IFNULL(vp.yesterday_total_points, 0) AS today_total_points, " +
    "(p.total_votes - IFNULL(vp.yesterday_total_points, 0)) AS yesterday_total_votes " +
    "FROM Picture p " +
    "LEFT JOIN ( SELECT pid, SUM(points) AS yesterday_total_points " +
    "FROM Votes WHERE DATE(create_at) = CURDATE() " +
    "GROUP BY pid ) vp " +
    "ON p.pid = vp.pid ORDER BY yesterday_total_votes DESC";
  conn.query(yesterdaySql, (err, yesterdayResult) => {
    if (err) {
      console.error("Error fetching yesterday data:", err);
      return res.json({ message: "Internal server error", status: 1 });
    }
    yesterdayList.push(...yesterdayResult);

    // เก็บ rank ของรูปภาพจากเมื่อวาน
    yesterdayRank.push(...yesterdayList.map((item) => item.pid));

    // Query สำหรับเก็บข้อมูลวันนี้
    const todaySql =
      "SELECT pid, pic, total_votes, charac_name, DATE_FORMAT(create_at, '%Y-%m-%d') AS create_date, mid FROM Picture ORDER BY total_votes DESC";
    conn.query(todaySql, (err, todayResult) => {
      if (err) {
        console.error("Error fetching today data:", err);
        return res.json({ message: "Internal server error", status: 1 });
      }
      todayList.push(...todayResult);

      let rankChanged: number[] = []; // เริ่มต้นด้วยรายการว่าง

      // ตรวจสอบว่าอันดับใน todayList และ yesterdayList ตรงกันหรือไม่
      let isSameRanking: boolean = true;

      for (let i = 0; i < todayList.length; i++) {
        const yesterdayIndex = yesterdayList.findIndex(
          (item) => item.pid === todayList[i].pid
        );

        if (yesterdayIndex === -1 || yesterdayIndex !== i) {
          // ถ้าไม่เท่ากับ -1 หรืออันดับไม่ตรงกันกับ index ใน todayList
          isSameRanking = false;
          break; // หยุดการทำงานเมื่อพบอันดับที่ไม่ตรงกัน
        }
      }

      // หาว่าอันดับเพิ่มหรือลด และเก็บค่าไว้ใน difference
      if (!isSameRanking) {
        for (let i = 0; i < todayList.length; i++) {
          const yesterdayIndex = yesterdayList.findIndex(
            (item) => item.pid === todayList[i].pid
          );

          if (yesterdayIndex !== -1) {
            rankChanged.push(yesterdayIndex - i);
          } else {
            rankChanged.push(i);
          }
        }
      } else {
        // ถ้าอันดับใน todayList และ yesterdayList ตรงกัน
        // ให้เติมค่า 0 ลงใน difference สำหรับทุกๆ รายการใน todayList
        rankChanged = Array(todayList.length).fill(0);
      }

      for (let i = 0; i < todayList.length; i++) {
        // เพิ่ม property "rankChanged"
        todayList[i].rankChanged = rankChanged[i] ? rankChanged[i] : 0; // ถ้าไม่มีการเปลี่ยนแปลงให้เป็น 0

        // เพิ่ม property "yesterdayRank"
        todayList[i].yesterdayRank =
          yesterdayRank.indexOf(todayList[i].pid) !== -1
            ? yesterdayRank.indexOf(todayList[i].pid) + 1
            : null;
      }

      // ส่งผลลัพธ์กลับไปให้ผู้ใช้
      return res.json({
        status: 0,
        // yesterdayList: yesterdayList,
        todayList: todayList, // เพิ่ม todayList เข้าไปใน JSON เพื่อดูข้อมูลได้ง่ายขึ้น
        // rankChanged: rankChanged, // เพิ่ม difference เข้าไปใน JSON เพื่อให้รู้ถึงการเปลี่ยนแปลงในอันดับ
      });
    });
  });
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
    "50",
    picture.charac_name,
    dateTime,
    picture.mid, // Provide the value for the mid column
  ]);
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.json({
      affected_row: result.affectedRows,
      last_idx: result.insertId,
      status: 1,
    });
  });
});

// router.get("/member/:mid", (req, res) => {
//   const memberId = req.params.mid;
//   conn.query(
//     "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` WHERE `mid` = ? ORDER BY `total_votes` DESC",
//     memberId,
//     (err, result, fields) => {
//       if (err) {
//         console.error("Error fetching data:", err);
//         return res.json({ message: "Internal server error",status:1 });
//       }
//       res.json({status:0,picture:result});

//     }
//   );
// });

router.get("/pid/:pid", (req, res) => {
  const pictureId = req.params.pid;
  conn.query(
    "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` WHERE pid = ?",
    [pictureId],
    (err, result, fields) => {
      if (err) {
        console.error("Error fetching picture:", err);
        return res.json({ message: "Internal server error", status: 1 });
      }

      // Check if the result array is empty (no picture found)
      if (result.length === 0) {
        return res.json({ message: "Picture not found", status: 1 });
      }

      // Picture found, return it
      res.json({ status: 0, picture: result });
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
    let sql = "UPDATE `Picture` SET `pic`=?,`charac_name`=? WHERE `pid`=?";
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
      return res.json({
        message: "Error checking picture existence",
        status: 1,
      });
    }

    // If the picture exists, proceed with deletion; otherwise, return an error
    if (result.length > 0) {
      // Picture exists, proceed with deletion
      conn.query("DELETE FROM Picture WHERE pid = ?", [id], (err, result) => {
        if (err) {
          console.error("Error deleting picture:", err);
          return res
            .status(500)
            .json({ message: "Error deleting picture", status: 1 });
        }
        res.json({
          message: "Delete Success",
          affected_row: result.affectedRows,
          starus: 0,
        });
      });
    } else {
      // Picture not found, return an error response
      res.json({ message: "Picture not found", status: 1 });
    }
  });
});

router.post("/random", (req, res) => {
  const pictures = req.body.list;
 if (pictures.length !== 0) {
  const pidNot = `(${pictures.join(',')})`
  conn.query(
    "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` WHERE pid not in "+pidNot+" ORDER BY RAND() LIMIT 2",
    (err, result, fields) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.json({status:1, message: "Internal server error" });
      }
      if (result.length<2) {
        return res.json({status:1, message: "Only 1 Pic" });
      }
      res.json({status:0,picture:result});
    }
  );
 }
 else{
  conn.query(
    "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` ORDER BY RAND() LIMIT 2",
    (err, result, fields) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.json({status:1, message: "Internal server error" });
      }
      res.json({status:0,picture:result});
    }
  );
 }
});

// router.get("/random", (req, res) => {
//   getRandomUniquePictures((err:any, randomPictures:any[]) => {
//     if (err) {
//       console.error("Error fetching random pictures:", err);
//       return res.json({ status: 1, message: "Internal server error" });
//     }
//     res.json({ status: 0, picture: randomPictures });
//   });
// });

// function getRandomUniquePictures(callback: any) {
//   const getRanDom = (callback: any) => {
//     conn.query(
//       "SELECT `pid`, `pic`, `total_votes`, `charac_name`, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_date, `mid` FROM `Picture` ORDER BY RAND() LIMIT 2",
//       (err, result) => {
//         if (err) {
//           return callback(err);
//         }
//         callback(null, result);
//       }
//     );
//   };

//   const getTwoVote = (callback: any) => {
//     conn.query(
//       "SELECT `pid`,`time` FROM `Votes` ORDER BY `vid` DESC LIMIT 2",
//       (err, result) => {
//         if (err) {
//           return callback(err);
//         }
//         callback(null, result);
//       }
//     );
//   };


//   const checkDuplicates = (randomPictures:any[], twoVotes:any[]) => {
//     if (!randomPictures || !twoVotes) {
//       return false;
//     }
//     const duplicatePids = randomPictures
//       .map((pic) => pic.pid)
//       .filter((pid) => twoVotes.some((vote) => vote.pid === pid));
//     return duplicatePids.length > 0;
//   };

//   const attemptRandomPictures = (attempts = 0) => {
//     if (attempts >= 10) {
//       return callback(new Error("Max attempts reached"));
//     }

//     getRanDom((err:any, randomPictures:any[]) => {
//       if (err) {
//         return callback(err);
//       }

//       getTwoVote((err:any, twoVotes:any[]) => {
//         if (err) {
//           return callback(err);
//         }

//         if (checkDuplicates(randomPictures || [], twoVotes || [])) {
//           attemptRandomPictures(attempts + 1); // Increase attempts and try again
//         } else {
//           callback(null, randomPictures);
//         }
//       });
//     });
//   };

//   attemptRandomPictures(); // Start attempting to generate unique random pictures
// }

router.get("/member/:id", (req, res) => {
  let id = +req.params.id;
  const yesterdayList: any[] = []; // เก็บผลลัพธ์ query ที่ดึงข้อมูลเมื่อวานมาเก็บไว้
  const todayList: any[] = []; // เก็บผลลัพธ์ query ที่ดึงข้อมูลวันนี้มาเก็บไว้
  const yesterdayRank: number[] = []; // เก็บ rank ของรูปภาพจากเมื่อวาน

  // Query สำหรับเก็บข้อมูลเมื่อวาน
  const yesterdaySql =
    "SELECT p.pid, p.pic, p.total_votes, p.charac_name, DATE_FORMAT(p.create_at, '%Y-%m-%d') AS create_date, p.mid, " +
    "IFNULL(vp.yesterday_total_points, 0) AS today_total_points, " +
    "(p.total_votes - IFNULL(vp.yesterday_total_points, 0)) AS yesterday_total_votes " +
    "FROM Picture p " +
    "LEFT JOIN ( SELECT pid, SUM(points) AS yesterday_total_points " +
    "FROM Votes WHERE DATE(create_at) = CURDATE() " +
    "GROUP BY pid ) vp " +
    "ON p.pid = vp.pid ORDER BY yesterday_total_votes DESC";
  conn.query(yesterdaySql, (err, yesterdayResult) => {
    if (err) {
      console.error("Error fetching yesterday data:", err);
      return res.json({ message: "Internal server error", status: 1 });
    }
    yesterdayList.push(...yesterdayResult);

    // เก็บ rank ของรูปภาพจากเมื่อวาน
    yesterdayRank.push(...yesterdayList.map((item) => item.pid));

    // Query สำหรับเก็บข้อมูลวันนี้
    const todaySql =
      "SELECT pid, pic, total_votes, charac_name, DATE_FORMAT(create_at, '%Y-%m-%d') AS create_date, mid FROM Picture ORDER BY total_votes DESC";
    conn.query(todaySql, (err, todayResult) => {
      if (err) {
        console.error("Error fetching today data:", err);
        return res.json({ message: "Internal server error", status: 1 });
      }
      todayList.push(...todayResult);

      let rankChanged: number[] = []; // เริ่มต้นด้วยรายการว่าง

      // ตรวจสอบว่าอันดับใน todayList และ yesterdayList ตรงกันหรือไม่
      let isSameRanking: boolean = true;

      for (let i = 0; i < todayList.length; i++) {
        const yesterdayIndex = yesterdayList.findIndex(
          (item) => item.pid === todayList[i].pid
        );

        if (yesterdayIndex === -1 || yesterdayIndex !== i) {
          // ถ้าไม่เท่ากับ -1 หรืออันดับไม่ตรงกันกับ index ใน todayList
          isSameRanking = false;
          break; // หยุดการทำงานเมื่อพบอันดับที่ไม่ตรงกัน
        }
      }

      // หาว่าอันดับเพิ่มหรือลด และเก็บค่าไว้ใน rankChanged
      if (!isSameRanking) {
        for (let i = 0; i < todayList.length; i++) {
          const yesterdayIndex = yesterdayList.findIndex(
            (item) => item.pid === todayList[i].pid
          );

          if (yesterdayIndex !== -1) {
            rankChanged.push(yesterdayIndex - i);
          } else {
            rankChanged.push(i);
          }
        }
      } else {
        // ถ้าอันดับใน todayList และ yesterdayList ตรงกัน
        // ให้เติมค่า 0 ลงใน rankChanged สำหรับทุกๆ รายการใน todayList
        rankChanged = Array(todayList.length).fill(0);
      }

      for (let i = 0; i < todayList.length; i++) {
        // เพิ่ม property "rankChanged"
        todayList[i].rankChanged = rankChanged[i] ? rankChanged[i] : 0; // ถ้าไม่มีการเปลี่ยนแปลงให้เป็น 0

        // เพิ่ม property "yesterdayRank"
        todayList[i].yesterdayRank =
          yesterdayRank.indexOf(todayList[i].pid) !== -1
            ? yesterdayRank.indexOf(todayList[i].pid) + 1
            : null;

        // คำนวณ todayRank โดยใช้ yesterdayRank และ rankChanged
        todayList[i].todayRank =
          todayList[i].yesterdayRank - todayList[i].rankChanged;
      }

      // กรองรูปภาพใน yesterdayList เฉพาะที่มี mid เท่ากับ id
      const filteredYesterdayList = yesterdayList.filter(
        (item) => item.mid === id
      );

      // กรองรูปภาพใน todayList เฉพาะที่มี mid เท่ากับ id
      const filteredTodayList = todayList.filter((item) => item.mid === id);
      if (
        filteredYesterdayList.length === 0 ||
        filteredTodayList.length === 0
      ) {
        return res.json({
          message: "No pictures found with the provided id",
          status: 1,
        });
      }

      // ส่งผลลัพธ์กลับไปให้ผู้ใช้
      return res.json({
        status: 0,
        picture: filteredTodayList,
      });
    });
  });
});
