import express from "express";
import { conn } from "../dbconnect";
import { VoteEntry, Votes } from "../model/VoteRequest";
import { giveCurrentDateTime } from "./myConst";
export const router = express.Router();

router.get("/", (req, res) => {
  conn.query(
    "SELECT vid,pid, vote,points,  DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_at FROM Votes",
    (err, result, fields) => {
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
      res.json({ status: 0, votes: result });
    }
  );
});

router.post("/", (req, res) => {
  const vote: Votes[] = req.body;
  const pic1 = vote[0];
  const pic2 = vote[1];
  var kMost: number;

  conn.query(
    "SELECT `pid`, `pic`, `total_votes`, `charac_name`, `create_at`, `mid` FROM `Picture` ORDER BY `total_votes` DESC LIMIT 1;",
    (err, result, fields) => {
      if (err) {
        console.error("Error querying kMost:", err);
        return res.json({ message: "Error querying kMost", status: 1 });
      }
      if (result.length === 0) {
        console.error("No data found for kMost");
        return res.json({ message: "No data found for kMost", status: 1 });
      }
      kMost = result[0].total_votes;

      console.log(pic1.pid.toString, pic2.pid.toString);

      let sql =
        "SELECT pid,total_votes FROM Picture WHERE pid = ? UNION SELECT pid,total_votes FROM Picture WHERE pid = ?";
      conn.query(sql, [pic1.pid, pic2.pid], async (err, result) => {
        if (err) {
          console.error("Error querying pictures:", err);
          return res.json({ message: "Error querying pictures", status: 1 });
        }
        if (result.length < 2) {
          console.error("pictures not found");
          return res.json({ message: "Pictures not found", status: 1 });
        }
        const data = await result;

        // old Score
        const pa = data[0].total_votes;
        const pb = data[1].total_votes;
        console.log("scA" + pa);
        console.log("scB" + pb);

        // win lose
        const va = parseInt(pic1.vote);
        const vb = parseInt(pic2.vote);
        console.log("reA" + va);
        console.log("reB" + vb);

        // rating score
        const Ea: number = +(1 / (1 + 10 ** ((pa - pb) / 400))).toFixed(3);
        const Eb: number = +(1 / (1 + 10 ** ((pb - pa) / 400))).toFixed(3);
        console.log("EA" + Ea);
        console.log("EB" + Eb);
        // k from old score
        const ka = K(kMost, pa);
        console.log("ka " + ka);
        const kb = K(kMost, pb);
        console.log("kb " + kb);

        // points
        const point1 = ka * (va - Ea);
        console.log("point1 " + point1);
        const point2 = kb * (vb - Eb);
        console.log("point2 " + point2);

        // new score
        const Ra: number = pa + point1;
        console.log("Ra " + Ra);
        const Rb: number = pb + point2;
        console.log("Rb " + Rb);

        //insert vote pa
        const s3 = await insertPointAsync(pic1.pid, pic1.vote, point1);
        if (s3 === 1 || s3 === 2) {
          return res.json({
            message: "Error inserting point for pic1",
            status: 1,
          });
        }
        // if (s3 === 2) {
        //   return res.json({
        //     message: "Please waiting ...",
        //     status: 1,
        //   });
        // }

        //insert vote pb
        const s4 = await insertPointAsync(pic2.pid, pic2.vote, point2);
        if (s4 === 1 || s4 === 2) {
          return res.json({
            message: "Error inserting point for pic2",
            status: 1,
          });
        }
        // if (s4 === 2) {
        //   return res.json({
        //     message: "Please waiting ...",
        //     status: 1,
        //   });
        // }

        //update score pa
        const s1 = await updateScoreAsync(pic1.pid, Ra);
        if (s1 === 1) {
          return res.json({
            message: "Error updating score for pic1",
            status: 1,
          });
        }

        //update score pb
        const s2 = await updateScoreAsync(pic2.pid, Rb);
        if (s2 === 1) {
          return res.json({
            message: "Error updating score for pic2",
            status: 1,
          });
        }

        return res.json({
          message: "Points inserted successfully",
          status: 0,
          algorithm: [
            {
              oldScore: pa,
              winloss: va,
              Erating: Ea,
              k: ka,
              Apoint: point1,
              newScore: Ra,
              algorithmEA: "EA = 1/(1+10^(" + pb + "-" + pa + ")/400)",
              algorithmRA: "NewScore = " + pa + "+" + ka + "(1-" + Ea + ")",
            },
            {
              oldScore: pb,
              winloss: vb,
              Erating: Eb,
              k: kb,
              Apoint: point2,
              newScore: Rb,
              algorithmEA: "EA = 1/(1+10^(" + pa + "-" + pb + ")/400)",
              algorithmRA: "NewScore = " + pb + "+" + kb + "(1-" + Eb + ")",
            },
          ],
        });
      });
    }
  );
});

export function K(kMost: number, score: number): number {
  const percen1 = (90 / 100) * kMost; //90%
  const percen2 = (60 / 100) * kMost; //60%

  if (score > percen1) {
    return 32;
  } else if (score > percen2) {
    return 24;
  } else {
    return 16;
  }
}

async function updateScoreAsync(pid: any, point: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    conn.query(
      "update Picture set total_votes = ? where pid = ?",
      [point, pid],
      (err, result) => {
        if (err) {
          console.error("Error updating score:", err);
          resolve(1);
        } else {
          resolve(0);
        }
      }
    );
  });
}

async function insertPointAsync(
  pid: number,
  vote: string,
  point: number
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    // ดึงข้อมูลโหวตล่าสุดสองรายการ
    const recentVotesQuery =
      "SELECT `pid`, `time` FROM `Votes` ORDER BY `vid` DESC LIMIT 2";
    conn.query(recentVotesQuery, async (err, votesResult) => {
      if (err) {
        console.error("Error querying recent votes:", err);
        resolve(1);
        return; // ออกจากฟังก์ชันหลังจาก resolve เพื่อหยุดการดำเนินการ
      }

      // ตรวจสอบว่ามีโหวตล่าสุดหรือไม่
      if (votesResult.length < 2) {
        console.error("Not enough recent votes found");
        resolve(1);
        return; // ออกจากฟังก์ชันหลังจาก resolve เพื่อหยุดการดำเนินการ
      }

      // ดึงข้อมูลการตั้งค่าเวลา
      const settingsQuery = "SELECT `secid`, `second` FROM `Setting`";
      conn.query(settingsQuery, async (err, settingsResult) => {
        if (err) {
          console.error("Error querying settings:", err);
          resolve(1);
          return; // ออกจากฟังก์ชันหลังจาก resolve เพื่อหยุดการดำเนินการ
        }

        // ตรวจสอบว่ามีการตั้งค่าเวลาหรือไม่
        if (settingsResult.length === 0) {
          console.error("No settings found");
          resolve(1);
          return; // ออกจากฟังก์ชันหลังจาก resolve เพื่อหยุดการดำเนินการ
        }
        
        const { secid, second } = settingsResult[0]; // สมมติว่ามีข้อมูลการตั้งค่าเวลาอยู่ใน index แรก

        // ดำเนินการตรวจสอบเวลา
        const currentTime = new Date();
        const recentVoteTime = new Date();
        const previousVoteTime = new Date();

        // แยกชั่วโมง, นาที, และวินาทีจาก timestamp
        const recentVoteTimeString = votesResult[0].time;
        const previousVoteTimeString = votesResult[1].time;

        const [recentHours, recentMinutes, recentSeconds] = recentVoteTimeString
          .split(":")
          .map(Number);
        const [previousHours, previousMinutes, previousSeconds] =
          previousVoteTimeString.split(":").map(Number);

        // กำหนดค่าให้กับ Object ของ Date ใหม่
        recentVoteTime.setHours(recentHours, recentMinutes, recentSeconds);
        previousVoteTime.setHours(
          previousHours,
          previousMinutes,
          previousSeconds
        );
        console.log("this time -> " + currentTime);
        console.log("db time -> " + votesResult[1].time);
        console.log("votesResult:", votesResult);
        console.log("votesResult[1].time:", votesResult[1].time);
        console.log("recentVoteTime:", recentVoteTime);
        console.log("previousVoteTime:", previousVoteTime);

        const currentTimeBKK = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

        const timeDifference =
          (currentTimeBKK.getTime() - previousVoteTime.getTime()) / 1000;
        console.log("timeDifference -> " + timeDifference);

        if (pid === votesResult[0].pid || pid === votesResult[1].pid) {
          // ตรวจสอบว่าโหวตล่าสุดเกินเวลาหรือไม่
          if (timeDifference < second) {
            console.log("Please wait before voting again");
            resolve(2);
            return; // ออกจากฟังก์ชันหลังจาก resolve เพื่อหยุดการดำเนินการ
          }
        }

        // ดำเนินการเพิ่มโหวต
        const date = giveCurrentDateTime();
        conn.query(
          "INSERT INTO Votes(pid, vote, points, create_at, time) VALUES (?, ?, ?, ?, CURTIME())",
          [pid, vote, point, date],
          (err, result) => {
            if (err) {
              console.error("Error inserting point:", err);
              resolve(1);
            } else {
              resolve(0);
            }
          }
        );
      });
    });
  });
}

router.get("/:pid", (req, res) => {
  const pid = req.params.pid;

  //try na do that day rank (not done yet)
  //   SELECT
  //     v.pid,
  //     DATE_FORMAT(v.create_at, '%Y-%m-%d') AS date,
  //     SUM(CASE WHEN v.vote = 1 THEN v.points ELSE 0 END) AS win_points,
  //     SUM(CASE WHEN v.vote = 0 THEN v.points ELSE 0 END) AS lose_points,
  //     SUM(v.points) AS total_points,
  //     p.total_votes - SUM(v.points) AS yesterday_votes,
  //    (p.total_votes - SUM(v.points)) + SUM(v.points) AS that_day_votes
  // FROM
  //     Votes v
  // INNER JOIN
  //     Picture p ON v.pid = p.pid
  // WHERE
  //     v.create_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND v.pid = 16
  // GROUP BY
  //     v.pid, DATE_FORMAT(v.create_at, '%Y-%m-%d')
  // ORDER BY
  //     DATE_FORMAT(v.create_at, '%Y-%m-%d') DESC;

  const sql =
    "SELECT pid,SUM(vote) AS total_votes,DATE_FORMAT(v.create_at, '%Y-%m-%d') AS create_at,SUM(CASE WHEN v.vote = 1 THEN v.points ELSE 0 END) AS win_points,SUM(CASE WHEN v.vote = 0 THEN v.points ELSE 0 END) AS lose_points,SUM(points) AS total_points " +
    "FROM Votes v " +
    "WHERE v.create_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND v.pid = ? " +
    "GROUP BY pid, create_at " +
    "ORDER BY create_at DESC";

  // Execute the SQL query
  conn.query(sql, [pid], (err, result) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.json({ message: "Internal server error", status: 1 });
    }

    //no picture
    if (result.length === 0) {
      return res.json({ message: "No data found", status: 1 });
    }

    let dateList: number[] = []; // List of dates
    let winList: number[] = []; // List of winning points
    let loseList: number[] = []; // List of losing points
    let pointList: number[] = [];
    let monthList = ""; // Name of the month
    let tmp: any = null;

    result.forEach((entry: VoteEntry) => {
      let win_points = entry.win_points; // win points
      let lose_points = entry.lose_points; // lose points
      let total_points = entry.total_points; // total points
      let date = new Date(entry.create_at); // Convert create_at string to Date object
      let formattedDate = date.getDate(); // Get  day of the month
      let month = date.getMonth() + 1; // Get the month (add 1 because January is 0)

      // Set the name of the month if not already set
      if (!monthList) {
        monthList = setnameMonth(date);
        tmp = month; // Update tmp with the current month
      }

      // If the month changes ->  ->  append  new month -> month
      if (tmp !== month) {
        monthList += "-" + setnameMonth(date);
        tmp = month;
      }

      // Add the formatted date to the dateList if not already present
      if (!dateList.includes(formattedDate)) {
        dateList.push(formattedDate);
      }

      // Find the index of the current date in dateList
      const dateIndex = dateList.indexOf(formattedDate);

      // If the win_points, lose_points, and total_points are undefined, set them to 0
      win_points = win_points ? win_points : 0;
      lose_points = lose_points ? lose_points : 0;
      total_points = total_points ? total_points : 0;

      // Push win_points, lose_points, and total_points to their respective lists
      winList.push(win_points);
      loseList.push(lose_points);
      pointList.push(total_points);
    });

    // Ensure that all lists have the same length
    while (winList.length < dateList.length) {
      winList.push(0);
    }
    while (loseList.length < dateList.length) {
      loseList.push(0);
    }
    while (pointList.length < dateList.length) {
      pointList.push(0);
    }

    // Send the processed data as a JSON response
    res.json({
      status: 0,
      monthList: monthList,
      dateList: dateList,
      winList: winList,
      loseList: loseList,
      pointsList: pointList,
    });
  });
});

// get  name of  month from date
function setnameMonth(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
}
