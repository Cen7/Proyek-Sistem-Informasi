import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import mysql from "mysql";
import moment from "moment";

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

app.get("/tes", (req, res) => {
  res.render("tes", { pageTitle: 'tes' });
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
  const { nama_lengkap, username, email, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.status(400).send("Password dan konfirmasi password tidak cocok.");
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const query = "INSERT INTO pengguna (nama_lengkap, username, email, password) VALUES (?, ?, ?, ?)";
    connection.query(query, [nama_lengkap, username, email, password], (err, results) => {
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

app.get("/admin-pengajuan", (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 8;
    const offset = (currentPage - 1) * itemsPerPage;

    const countQuery = "SELECT COUNT(*) AS count FROM lapak WHERE status_lapak ='menunggu'";
    connection.query(countQuery, (err, countResult) => {
      if (err) {
        console.error("Error executing count query:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalCount = countResult[0].count;
      const pageCount = Math.ceil(totalCount / itemsPerPage);

      const query = `
        SELECT id_lapak, nama_lapak, tanggal_pengajuan, lokasi_lapak, status_lapak 
        FROM lapak 
        WHERE status_lapak ='menunggu'
        LIMIT ? OFFSET ?`;

      connection.query(query, [itemsPerPage, offset], (err, results) => {
        connection.release();

        if (err) {
          console.error("Error executing query:", err.message);
          res.sendStatus(500);
          return;
        }

        results.forEach(lapak => {
          lapak.tanggal_pengajuan = moment(lapak.tanggal_pengajuan).format('MMMM D, YYYY');
        });

        res.render("admin-pengajuan", {
          pageTitle: 'Daftar Pengajuan Lapak',
          lapakList: results,
          dataCount: totalCount,
          pageCount: pageCount,
          currentPage: currentPage
        });
      });
    });
  });
});

app.get("/admin-informasi-lapak-pengajuan/:id_lapak", (req, res) => {
  const idLapak = parseInt(req.params.id_lapak);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).send('Server error');
      return;
    }

    const lapakQuery = 'SELECT * FROM lapak WHERE id_lapak = ?';
    connection.query(lapakQuery, [idLapak], (err, lapakResults) => {
      if (err) {
        console.error('Error fetching lapak data:', err);
        res.status(500).send('Server error');
        return;
      }

      if (lapakResults.length === 0) {
        res.status(404).send("Lapak not found");
        return;
      }

      const lapak = lapakResults[0];

      const bukaQuery = `
        SELECT hari.nama_hari, buka.jam_buka, buka.jam_tutup
        FROM buka
        JOIN hari ON buka.id_hari = hari.id_hari
        WHERE buka.id_lapak = ?
      `;
      connection.query(bukaQuery, [idLapak], (err, bukaResults) => {
        connection.release();

        if (err) {
          console.error('Error fetching buka data:', err);
          res.status(500).send('Server error');
          return;
        }

        const formattedBukaResults = bukaResults.map(result => {
          return {
            hari: result.nama_hari,
            jam_buka: result.jam_buka,
            jam_tutup: result.jam_tutup
          };
        });
        
        lapak.jam_buka = formattedBukaResults;
        res.render("admin-informasi-lapak-pengajuan", { lapak, pageTitle: 'Informasi Lapak' });
        
      });
    });
  });
});

// Tambahkan rute untuk menerima lapak
app.post('/admin-informasi-lapak-pengajuan/:id_lapak/accept', (req, res) => {
  const idLapak = parseInt(req.params.id_lapak);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).send('Server error');
      return;
    }

    const acceptQuery = 'UPDATE lapak SET status_lapak = "terverifikasi" WHERE id_lapak = ?';
    connection.query(acceptQuery, [idLapak], (err, results) => {
      connection.release();

      if (err) {
        console.error('Error updating lapak status:', err);
        res.status(500).send('Server error');
        return;
      }

      res.sendStatus(200);
    });
  });
});

// Tambahkan rute untuk menolak lapak
app.post('/admin-informasi-lapak-pengajuan/:id_lapak/reject', (req, res) => {
  const idLapak = parseInt(req.params.id_lapak);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).send('Server error');
      return;
    }

    connection.beginTransaction(err => {
      if (err) {
        console.error('Error starting transaction:', err);
        res.status(500).send('Server error');
        return;
      }

      const deleteBukaQuery = 'DELETE FROM buka WHERE id_lapak = ?';
      connection.query(deleteBukaQuery, [idLapak], (err, results) => {
        if (err) {
          return connection.rollback(() => {
            console.error('Error deleting from buka:', err);
            res.status(500).send('Server error');
          });
        }

        const deleteLapakQuery = 'DELETE FROM lapak WHERE id_lapak = ?';
        connection.query(deleteLapakQuery, [idLapak], (err, results) => {
          if (err) {
            return connection.rollback(() => {
              console.error('Error deleting from lapak:', err);
              res.status(500).send('Server error');
            });
          }

          connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                console.error('Error committing transaction:', err);
                res.status(500).send('Server error');
              });
            }

            res.sendStatus(200);
          });
        });
      });
    });
  });
});



app.get("/admin-terverifikasi", (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 8;
    const offset = (currentPage - 1) * itemsPerPage;

    const countQuery = "SELECT COUNT(*) AS count FROM lapak WHERE status_lapak ='terverifikasi'";
    connection.query(countQuery, (err, countResult) => {
      if (err) {
        console.error("Error executing count query:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalCount = countResult[0].count;
      const pageCount = Math.ceil(totalCount / itemsPerPage);

      const query = `
        SELECT l.id_lapak, l.nama_lapak, l.tanggal_pengajuan, l.lokasi_lapak, l.status_lapak, 
               COALESCE(AVG(u.rating), 0) AS rata_rating,
               (SELECT COUNT(*) FROM laporan r WHERE r.id_lapak = l.id_lapak) AS total_laporan,
               (SELECT COUNT(*) FROM laporan r WHERE r.id_lapak = l.id_lapak AND r.status = 'pending') AS total_laporan_tertunda
        FROM lapak l
        LEFT JOIN ulasan u ON l.id_lapak = u.id_lapak
        WHERE l.status_lapak ='terverifikasi'
        GROUP BY l.id_lapak, l.nama_lapak, l.tanggal_pengajuan, l.lokasi_lapak, l.status_lapak
        LIMIT ? OFFSET ?`;

      connection.query(query, [itemsPerPage, offset], (err, results) => {
        connection.release();

        if (err) {
          console.error("Error executing query:", err.message);
          res.sendStatus(500);
          return;
        }

        results.forEach(lapak => {
          lapak.tanggal_pengajuan = moment(lapak.tanggal_pengajuan).format('MMMM D, YYYY');
        });

        res.render("admin-terverifikasi", {
          pageTitle: 'Daftar Lapak Terverifikasi',
          lapakList: results,
          dataCount: totalCount,
          pageCount: pageCount,
          currentPage: currentPage
        });
      });
    });
  });
});

app.get("/admin-informasi-lapak-terverifikasi/:id_lapak", (req, res) => {
  const idLapak = parseInt(req.params.id_lapak);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).send('Server error');
      return;
    }

    const lapakQuery = 'SELECT * FROM lapak WHERE id_lapak = ?';
    connection.query(lapakQuery, [idLapak], (err, lapakResults) => {
      if (err) {
        console.error('Error fetching lapak data:', err);
        res.status(500).send('Server error');
        return;
      }

      if (lapakResults.length === 0) {
        res.status(404).send("Lapak not found");
        return;
      }

      const lapak = lapakResults[0];

      const bukaQuery = `
        SELECT hari.nama_hari, buka.jam_buka, buka.jam_tutup
        FROM buka
        JOIN hari ON buka.id_hari = hari.id_hari
        WHERE buka.id_lapak = ?
      `;
      connection.query(bukaQuery, [idLapak], (err, bukaResults) => {
        if (err) {
          console.error('Error fetching buka data:', err);
          res.status(500).send('Server error');
          return;
        }

        const formattedBukaResults = bukaResults.map(result => {
          return {
            hari: result.nama_hari,
            jam_buka: result.jam_buka,
            jam_tutup: result.jam_tutup
          };
        });
        
        lapak.jam_buka = formattedBukaResults;

        const laporanQuery = `
          SELECT pengguna.nama_lengkap, laporan_lapak.alasan_lapak, laporan_lapak.foto
          FROM laporan
          JOIN laporan_lapak ON laporan.id_laporan = laporan_lapak.id_laporan
          JOIN pengguna ON laporan.id_pengguna = pengguna.id_pengguna
          WHERE laporan.id_lapak = ? AND laporan.status = 'approved'
        `;
        
        connection.query(laporanQuery, [idLapak], (err, laporanResults) => {
          connection.release();
          
          if (err) {
            console.error('Error fetching laporan data:', err);
            res.status(500).send('Server error');
            return;
          }
          
          res.render("admin-informasi-lapak-terverifikasi", { lapak, laporan: laporanResults, pageTitle: 'Informasi Lapak' });
        });
      });
    });
  });
});

app.get("/admin-informasi-lapak-laporan-tertunda/:id_lapak", (req, res) => {
  const idLapak = parseInt(req.params.id_lapak);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).send('Server error');
      return;
    }

    const lapakQuery = 'SELECT * FROM lapak WHERE id_lapak = ?';
    connection.query(lapakQuery, [idLapak], (err, lapakResults) => {
      if (err) {
        console.error('Error fetching lapak data:', err);
        res.status(500).send('Server error');
        return;
      }

      if (lapakResults.length === 0) {
        res.status(404).send("Lapak not found");
        return;
      }

      const lapak = lapakResults[0];

      const bukaQuery = `
        SELECT hari.nama_hari, buka.jam_buka, buka.jam_tutup
        FROM buka
        JOIN hari ON buka.id_hari = hari.id_hari
        WHERE buka.id_lapak = ?
      `;
      connection.query(bukaQuery, [idLapak], (err, bukaResults) => {
        if (err) {
          console.error('Error fetching buka data:', err);
          res.status(500).send('Server error');
          return;
        }

        const formattedBukaResults = bukaResults.map(result => {
          return {
            hari: result.nama_hari,
            jam_buka: result.jam_buka,
            jam_tutup: result.jam_tutup
          };
        });
        
        lapak.jam_buka = formattedBukaResults;

        const laporanQuery = `
          SELECT laporan.id_laporan, pengguna.nama_lengkap, laporan_lapak.alasan_lapak, laporan_lapak.foto
          FROM laporan
          JOIN laporan_lapak ON laporan.id_laporan = laporan_lapak.id_laporan
          JOIN pengguna ON laporan.id_pengguna = pengguna.id_pengguna
          WHERE laporan.id_lapak = ? AND laporan.status = 'pending'
        `;


        
        connection.query(laporanQuery, [idLapak], (err, laporanResults) => {
          connection.release();
          
          if (err) {
            console.error('Error fetching laporan data:', err);
            res.status(500).send('Server error');
            return;
          }
          
          res.render("admin-informasi-lapak-laporan-tertunda", { lapak, laporan: laporanResults, pageTitle: 'Informasi Laporan Lapak Tertunda' });
        });
      });
    });
  });
});

app.post('/laporan/approve/:id_laporan', (req, res) => {
  const idLaporan = parseInt(req.params.id_laporan);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).json({ success: false, message: 'Server error' });
      return;
    }

    const approveQuery = 'UPDATE laporan SET status = ? WHERE id_laporan = ?';
    connection.query(approveQuery, ['approved', idLaporan], (err, results) => {
      connection.release();

      if (err) {
        console.error('Error updating laporan:', err);
        res.status(500).json({ success: false, message: 'Server error' });
        return;
      }

      res.json({ success: true });
    });
  });
});

app.post('/laporan/reject/:id_laporan', (req, res) => {
  const idLaporan = parseInt(req.params.id_laporan);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).json({ success: false, message: 'Server error' });
      return;
    }

    const deleteLaporanLapakQuery = 'DELETE FROM laporan_lapak WHERE id_laporan = ?';
    connection.query(deleteLaporanLapakQuery, [idLaporan], (err, results) => {
      if (err) {
        connection.release();
        console.error('Error deleting from laporan_lapak:', err);
        res.status(500).json({ success: false, message: 'Server error' });
        return;
      }

      const deleteLaporanQuery = 'DELETE FROM laporan WHERE id_laporan = ?';
      connection.query(deleteLaporanQuery, [idLaporan], (err, results) => {
        connection.release();

        if (err) {
          console.error('Error deleting from laporan:', err);
          res.status(500).json({ success: false, message: 'Server error' });
          return;
        }

        res.json({ success: true });
      });
    });
  });
});



