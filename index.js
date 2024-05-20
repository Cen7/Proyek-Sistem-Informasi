import express from "express";
import path from "path";
import session from "cookie-session";
// import crypto from "crypto";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import mysql from "mysql";
import forge from "node-forge";

const port = 8000;
const app = express();
app.use(cookieParser());
const publicPath = path.resolve("static-path");

app.use(express.static(publicPath));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const pool = mysql.createPool({
  multipleStatements: true,
  user: "root",
  password: "",
  database: "prosi",
  host: "127.0.0.1",
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

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/admin-blokir", (req, res) => {
  res.render("admin-blokir");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/admin-terverifikasi", (req, res) => {
  res.render("admin-terverifikasi");
});

app.get("/admin-pengajuan", (req, res) => {
  res.render("admin-pengajuan");
});

app.get("/tes", (req, res) => {
  res.render("tes");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const query = "SELECT * FROM pengguna WHERE username = ? AND password = ?";
    connection.query(query, [username, password], (err, results) => {
      connection.release();

      if (err) {
        console.error("Error executing query:", err.message);
        res.sendStatus(500);
        return;
      }

      if (results.length > 0) {
        res.redirect("/admin-pengajuan");
      } else {
        res.redirect("/?error=1"); 
      }
    });
  });
});

app.post("/signup", (req, res) => {
  const { fullname, username, email, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.status(400).send("Password dan konfirmasi password tidak cocok.");
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const query = "INSERT INTO pengguna (fullname, username, email, password) VALUES (?, ?, ?, ?)";
    connection.query(query, [fullname, username, email, password], (err, results) => {
      connection.release();

      if (err) {
        console.error("Error executing query:", err.message);
        res.sendStatus(500);
        return;
      }

      res.redirect("/admin-pengajuan");
    });
  });
});
