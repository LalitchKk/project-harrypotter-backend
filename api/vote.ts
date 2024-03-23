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

        const s1 = await updateScoreAsync(pic1.pid, Ra);
        if (s1 === 1) {
          return res.json({
            message: "Error updating score for pic1",
            status: 1,
          });
        }

        const s2 = await updateScoreAsync(pic2.pid, Rb);
        if (s2 === 1) {
          return res.json({
            message: "Error updating score for pic2",
            status: 1,
          });
        }

        const s3 = await insertPointAsync(pic1.pid, pic1.vote, point1);
        if (s3 === 1) {
          return res.json({
            message: "Error inserting point for pic1",
            status: 1,
          });
        }

        const s4 = await insertPointAsync(pic2.pid, pic2.vote, point2);
        if (s4 === 1) {
          return res.json({
            message: "Error inserting point for pic2",
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
              k:ka,
              Apoint: point1,
              newScore: Ra,
              algorithmEA:"EA = 1/(1+10^("+pb+"-"+pa+")/400)",
              algorithmRA:"NewScore = "+pa+"+"+ka+"(1-"+Ea+")"
            },
            {
              oldScore: pb,
              winloss: vb,
              Erating: Eb,
              k:kb,
              Apoint: point2,
              newScore: Rb,
              algorithmEA:"EA = 1/(1+10^("+pa+"-"+pb+")/400)",
              algorithmRA:"NewScore = "+pb+"+"+kb+"(1-"+Eb+")"
            },
          ],
        });
      });
    }
  );
});

export function K(kMost: number, score: number): number {
  const percen1 = (90 / 100) * kMost;//90%
  const percen2 = (60 / 100) * kMost;//60%

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
  const date = giveCurrentDateTime();
  return new Promise<number>((resolve, reject) => {
    conn.query(
      "INSERT INTO Votes(pid, vote, points, create_at) VALUES (?, ?, ?, ?)",
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
}

router.get("/:pid", (req, res) => {
  const pid = req.params.pid;

  const sql =
    "SELECT pid, vote, SUM(points) AS totalPoint, DATE_FORMAT(`create_at`, '%Y-%m-%d') AS create_at " +
    "FROM Votes " +
    "WHERE `create_at` >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND pid = ? " +
    "GROUP BY vote, create_at " +
    "ORDER BY `create_at`, vote";

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
    let monthList = ""; // Name of the month
    let tmp: any = null;

    result.forEach((entry: VoteEntry) => {
      let res = entry.vote; // The vote result (0 or 1)
      let totalPoint = entry.totalPoint; // Total points
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
      console.log("dateIndex" + dateIndex);

      // If the vote result is 0, add points to loseList at the corresponding index, else add to winList
      if (res == 0) {
        console.log("res ==  " + res);

        if (loseList[dateIndex] === undefined) {
          loseList[dateIndex] = Math.abs(totalPoint);
          winList[dateIndex] = 0;
          console.log("loseList" + loseList);
          console.log("winList" + winList);
        } else {
          loseList[dateIndex] += Math.abs(totalPoint);
          console.log("loseList" + loseList);
        }
      } else if (res == 1) {
        if (winList[dateIndex] === undefined) {
          winList[dateIndex] = totalPoint;
          loseList[dateIndex] = 0;
          console.log("winList" + winList);
          console.log("loseList" + loseList);
        } else {
          winList[dateIndex] += totalPoint;
          console.log("winList" + winList);
        }
      }
      console.log("dateList -> " + dateList);
    });

    //push to list
    while (winList.length < dateList.length) {
      winList.push(0);
    }
    while (loseList.length < dateList.length) {
      loseList.push(0);
    }

    // Send the processed data as a JSON response
    res.json({
      status: 0,
      monthList: monthList,
      dateList: dateList,
      winList: winList,
      loseList: loseList,
    });
  });
});

// get  name of  month from date
function setnameMonth(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
}









