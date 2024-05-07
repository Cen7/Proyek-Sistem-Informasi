import express from "express";
import path from "path";
import session from "cookie-session";
// import crypto from "crypto";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import mysql from "mysql";
import forge from "node-forge";

// const express = require("express");
// const mysql = require("mysql");

const port = 8000;
const app = express();
app.use(cookieParser());
const publicPath = path.resolve("static-path");

app.use(express.static(publicPath));
app.set("view engine", "ejs");

// app.set("view engine", "ejs");
// app.use(express.static("public"));

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

app.get("/admin-dashboard", (req, res) => {
  res.render("admin-dashboard");
});

app.get("/admin-terverifikasi", (req, res) => {
  res.render("admin-terverifikasi");
});

app.get("/admin-pengajuan", (req, res) => {
  res.render("admin-pengajuan");
});