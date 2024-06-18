import express from "express";
import path from "path";
import session from "cookie-session";
// import crypto from "crypto";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import mysql from "mysql";
import forge from "node-forge";
import multer from "multer";

const port = 8011;
const app = express();
app.use(cookieParser());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const publicPath = path.resolve("static-path");

app.use(express.static(publicPath));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const pool = mysql.createPool({
  multipleStatements: true,
  user: "root",
  password: "",
  database: "testing",
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

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

app.use(session({
  name: 'session',
  keys: ['key1', 'key2'], 
  maxAge: 24 * 60 * 60 * 1000 // 24 jam
}));

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

app.get("/tes", (req, res) => {
  res.render("tes");
});

app.get("/teschat", (req, res) => {
  res.render("teschat");
});

app.get("/admin-terverifikasi", (req, res) => {
  res.render("admin-terverifikasi" , { pageTitle: 'Daftar Lapak Terverifikasi' });
});

app.get("/admin-pengajuan", (req, res) => {
  res.render("admin-pengajuan" , { pageTitle: 'Daftar Pengajuan Lapak' });
});

// app.get("/pusat-bantuan", (req, res) => {
//   res.render("pusat-bantuan" , { pageTitle: 'Pusat Bantuan' });
// });

// app.get("/pusat-bantuan2", (req, res) => {
//   res.render("pusat-bantuan2" , { pageTitle: 'Pusat Bantuan' });
// });

app.get("/informasi-pengajuan-bantuan", (req, res) => {
  res.render("informasi-pengajuan-bantuan" , { pageTitle: 'Pusat Bantuan' });
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
        const user = results[0];
        req.session.user = {
          id: user.id_pengguna,
          username: user.username,
          role: user.role
        };
        
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


// app.get("/pusat-bantuan", (req, res) => {
//   pool.query(
//     `SELECT t.ticket_id, t.subject, t.created_at, t.status, u.username 
//      FROM support_tickets t 
//      JOIN pengguna u ON t.user_id = u.id_pengguna`,
//     (error, results) => {
//       if (error) throw error;
//       res.render("pusat-bantuan", { tickets: results });
//     }
//   );
// });

app.get("/pusat-bantuan", (req, res) => {
  const currentPage = parseInt(req.query.page) || 1;
  const itemsPerPage = 8;
  const offset = (currentPage - 1) * itemsPerPage;
  const searchQuery = req.query.search || "";

  let countQuery = "SELECT COUNT(*) AS count FROM support_tickets t JOIN pengguna u ON t.user_id = u.id_pengguna";
  let dataQuery = `
    SELECT t.ticket_id, t.subject, t.created_at, t.status, u.username 
    FROM support_tickets t 
    JOIN pengguna u ON t.user_id = u.id_pengguna
  `;

  if (searchQuery) {
    countQuery += " WHERE t.subject LIKE ? OR u.username LIKE ?";
    dataQuery += " WHERE t.subject LIKE ? OR u.username LIKE ?";
  }

  dataQuery += " LIMIT ? OFFSET ?";

  const countParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : [];
  const dataParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`, itemsPerPage, offset] : [itemsPerPage, offset];

  pool.query(countQuery, countParams, (err, countResult) => {
    if (err) {
      console.error("Error executing count query:", err.message);
      res.sendStatus(500);
      return;
    }

    const totalCount = countResult[0].count;
    const pageCount = Math.ceil(totalCount / itemsPerPage);

    pool.query(dataQuery, dataParams, (error, results) => {
      if (error) {
        console.error("Error executing data query:", error.message);
        res.sendStatus(500);
        return;
      }

      res.render("pusat-bantuan", {
        pageTitle: 'Pusat Bantuan',
        tickets: results,
        dataCount: totalCount,
        pageCount: pageCount,
        currentPage: currentPage,
        searchQuery: searchQuery,
        searchAction: '/pusat-bantuan'
      });
    });
  });
});


app.get("/pusat-bantuan/:id", (req, res) => {
  const ticketId = req.params.id;
  pool.query(
    `SELECT m.*, u.username, a.file_path 
     FROM messages m 
     JOIN pengguna u ON m.sender_id = u.id_pengguna 
     LEFT JOIN attachments a ON m.message_id = a.message_id
     WHERE m.ticket_id = ? 
     ORDER BY m.created_at`,
    [ticketId],
    (error, results) => {
      if (error) throw error;
      pool.query(
        `SELECT t.*, u.username 
         FROM support_tickets t 
         JOIN pengguna u ON t.user_id = u.id_pengguna 
         WHERE t.ticket_id = ?`,
        [ticketId],
        (error, ticket) => {
          if (error) throw error;
          res.render("pusat-bantuan2", { messages: results, ticket: ticket[0] });
        }
      );
    }
  );
});


// app.post("/send-message", (req, res) => {
//   const { text } = req.body;
//   const ticketId = req.query.ticketId; 
//   const senderId = req.session.user.id; 
//   const senderType = "admin";

//   pool.query(
//     `INSERT INTO messages (ticket_id, sender_id, sender_type, message, created_at) 
//      VALUES (?, ?, ?, ?, NOW())`,
//     [ticketId, senderId, senderType, text],
//     (error) => {
//       if (error) throw error;
//       res.sendStatus(200);
//     }
//   );
// });

app.post("/send-message", (req, res) => {
  const { text } = req.body;
  const ticketId = req.query.ticketId; 
  const senderId = req.session.user.id; 
  const senderType = "admin";

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error("Error starting transaction:", err.message);
        res.sendStatus(500);
        return;
      }

      // Insert the message
      const insertMessageQuery = `
        INSERT INTO messages (ticket_id, sender_id, sender_type, message, created_at) 
        VALUES (?, ?, ?, ?, NOW())
      `;

      connection.query(insertMessageQuery, [ticketId, senderId, senderType, text], (error) => {
        if (error) {
          return connection.rollback(() => {
            connection.release();
            console.error("Error inserting message:", error.message);
            res.sendStatus(500);
          });
        }

        if (text === "/selesai") {
          const updateTicketQuery = `
            UPDATE support_tickets 
            SET status = 'closed' 
            WHERE ticket_id = ?
          `;

          connection.query(updateTicketQuery, [ticketId], (error) => {
            if (error) {
              return connection.rollback(() => {
                connection.release();
                console.error("Error updating ticket status:", error.message);
                res.sendStatus(500);
              });
            }

            connection.commit((err) => {
              connection.release();
              if (err) {
                return connection.rollback(() => {
                  console.error("Error committing transaction:", err.message);
                  res.sendStatus(500);
                });
              }

              res.sendStatus(200);
            });
          });
        } else {
          connection.commit((err) => {
            connection.release();
            if (err) {
              return connection.rollback(() => {
                console.error("Error committing transaction:", err.message);
                res.sendStatus(500);
              });
            }

            res.sendStatus(200);
          });
        }
      });
    });
  });
});



app.post("/send-photo", upload.single('photo'), (req, res) => {
  const ticketId = req.query.ticketId;
  const senderId = req.session.user.id;
  const senderType = "admin";
  const photo = req.file.buffer;

  pool.query(
    `INSERT INTO messages (ticket_id, sender_id, sender_type, message, created_at) 
     VALUES (?, ?, ?, ?, NOW())`,
    [ticketId, senderId, senderType, null],
    (error, result) => {
      if (error) throw error;
      const messageId = result.insertId;
      pool.query(
        `INSERT INTO attachments (message_id, file_path, file_type, uploaded_at) 
         VALUES (?, ?, ?, NOW())`,
        [messageId, photo, req.file.mimetype],
        (error) => {
          if (error) throw error;
          res.json({ photoPath: `data:${req.file.mimetype};base64,${photo.toString('base64')}` });
        }
      );
    }
  );
});