const express = require("express");
const mysql = require("mysql");

const port = 8000;
const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));

const pool = mysql.createPool({
  multipleStatements: true,
  user: "root",
  password: "",
  database: "prosi",
  host: "127.0.0.1",
  port: 3306,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to database:", err.message);
  } else {
    console.log("Connected to database");
    connection.release();
  }
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
  });

app.get("/", (req, res) => {
    res.render("login");
});