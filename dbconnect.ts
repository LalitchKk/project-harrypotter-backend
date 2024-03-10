import mysql from "mysql";

export const conn = mysql.createPool({
  connectionLimit: 10,
  host: "202.28.34.197",
  user: "proj64_taxitax",
  password: "20452194LW",
  database: "proj64_taxitax",
});