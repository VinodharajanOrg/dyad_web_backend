import "dotenv/config";

import { readFileSync } from "fs";
import { Pool } from "pg";

let sql = "";

async function initDb() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  
  const sql = readFileSync("./src/db/dyad_schema.sql", "utf8");
  console.log("FIRST BYTES:", Buffer.from(sql.slice(0, 4), "utf8"));

  // DEBUG: print first part of SQL
  //console.log("----- SQL START -----");
  //console.log(sql.substring(0, 1200));
  //console.log("----- SQL END -----");

  //const result = await pool.query("SHOW search_path;");
  //console.log("Search path is:", result.rows[0].search_path);

  //console.log("SQL LENGTH:", sql.length);
  //console.log("SQL BUFFER LENGTH:", Buffer.byteLength(sql, "utf8"));

  console.log("Running schema...");
  await pool.query(sql);
  //const dbInfo = await pool.query("SELECT current_database(), current_schema()");
   //console.log("Connected to DB:", dbInfo.rows[0]);

  console.log("Database initialized.");
  await pool.end();
  
}

initDb().catch(err => {
  console.error("ERROR RUNNING INIT-DB");
  console.error(err);

  // ------- THIS IS WHERE YOU PASTE THE NEW CODE -------
  if (err.position) {
    console.log("\n---- ERROR CONTEXT ----");

    const bytePos = parseInt(err.position, 10);

    // Convert SQL string to a Buffer so we can slice by byte index
    const buf = Buffer.from(sql, "utf8");

    const start = Math.max(0, bytePos - 200);
    const end = Math.min(buf.length, bytePos + 200);

    const context = buf.slice(start, end).toString("utf8");

    console.log(context);
    console.log("---- END ERROR CONTEXT ----");
  }
  // ----------------------------------------------------
});