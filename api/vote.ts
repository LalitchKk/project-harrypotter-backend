import express from "express";
import { conn } from "../dbconnect";
import { Votes } from "../model/VoteRequest";
import { giveCurrentDateTime } from "./myConst";
export const router = express.Router();

router.get("/", (req, res) => {
  conn.query(
    "SELECT vid,pid, vote,points, DATE(create_at) AS create_date FROM Votes",
    (err, result, fields) => {
      if (err) {
        console.error("Error fetching data:", err);
        return res.json({ message: "Internal server error", status: 1 });
      }
      // Modify the response to remove the time part from the create_date field
      result.forEach((entry: any) => {
        entry.create_date = entry.create_date.toISOString().split("T")[0];
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
        return res.json({message:"Error querying kMost",status:1});
      }
      if (result.length === 0) {
        console.error("No data found for kMost");
        return res.json({message:"No data found for kMost",status:1});
      }
      kMost = result[0].total_votes;

      console.log(pic1.pid.toString,pic2.pid.toString);
      
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

        // win loss
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
        console.log("ka "+ka);
        const kb = K(kMost, pb);
        console.log("kb "+kb);

        // points
        const point1 = ka * (va - Ea);
        console.log("point1 "+point1);
        const point2 = kb * (vb - Eb);
        console.log("point2 "+point2);

        // new score
        const Ra: number = pa + point1;
        console.log("Ra "+Ra);
        const Rb: number = pb + point2;
        console.log("Rb "+Rb);

        const date = giveCurrentDateTime();

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

        const s3 = await insertPointAsync(pic1.pid, pic1.vote, point1, date);
        if (s3 === 1) {
          return res.json({
            message: "Error inserting point for pic1",
            status: 1,
          });
        }

        const s4 = await insertPointAsync(pic2.pid, pic2.vote, point2, date);
        if (s4 === 1) {
          return res.json({
            message: "Error inserting point for pic2",
            status: 1,
          });
        }

        return res.json({ message: "Points inserted successfully", status: 0,algorithm:[
            {
                oldScore:pa,
                winloss:va,
                Erating:Ea,
                Apoint:point1,
                newScore:Ra
            },
            {
                oldScore:pb,
                winloss:vb,
                Erating:Eb,
                Apoint:point2,
                newScore:Rb
            }
        ] });
      });
    }
  );
});

export function K(kMost: number, score: number): number {


  if (score>(30 / kMost) * 100) {
    return 16;
  } else if (score>(30 / kMost) * 100 && score>(60 / kMost) * 100) {
    return 24;
  } else {
    return 32;
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
  point: number,
  date: string
): Promise<number> {
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
