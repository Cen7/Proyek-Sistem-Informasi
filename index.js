import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import mysql from "mysql";
import moment from "moment";

const port = 8080;
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
    const searchQuery = req.query.search || "";

    let countQuery = "SELECT COUNT(*) AS count FROM lapak WHERE status_lapak ='menunggu'";
    let dataQuery = `
      SELECT id_lapak, nama_lapak, tanggal_pengajuan, lokasi_lapak, status_lapak 
      FROM lapak 
      WHERE status_lapak ='menunggu' 
    `;

    if (searchQuery) {
      countQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
      dataQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
    }

    dataQuery += " LIMIT ? OFFSET ?";

    const countParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : [];
    const dataParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`, itemsPerPage, offset] : [itemsPerPage, offset];

    connection.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error("Error executing count query:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalCount = countResult[0].count;
      const pageCount = Math.ceil(totalCount / itemsPerPage);

      connection.query(dataQuery, dataParams, (err, results) => {
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
          currentPage: currentPage,
          searchQuery: searchQuery,
          searchAction: '/admin-pengajuan'
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
    const searchQuery = req.query.search || "";

    let countQuery = "SELECT COUNT(*) AS count FROM lapak WHERE status_lapak ='terverifikasi'";
    let dataQuery = `
      SELECT l.id_lapak, l.nama_lapak, l.tanggal_pengajuan, l.lokasi_lapak, l.status_lapak, 
             COALESCE(AVG(u.rating), 0) AS rata_rating,
             (SELECT COUNT(*) FROM laporan r WHERE r.id_lapak = l.id_lapak) AS total_laporan,
             (SELECT COUNT(*) FROM laporan r WHERE r.id_lapak = l.id_lapak AND r.status = 'pending') AS total_laporan_tertunda
      FROM lapak l
      LEFT JOIN ulasan u ON l.id_lapak = u.id_lapak
      WHERE l.status_lapak ='terverifikasi'
    `;

    if (searchQuery) {
      countQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
      dataQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
    }

    dataQuery += " GROUP BY id_lapak, nama_lapak, tanggal_pengajuan, lokasi_lapak, status_lapak LIMIT ? OFFSET ?";

    const countParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : [];
    const dataParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`, itemsPerPage, offset] : [itemsPerPage, offset];

    connection.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error("Error executing count query:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalCount = countResult[0].count;
      const pageCount = Math.ceil(totalCount / itemsPerPage);

      connection.query(dataQuery, dataParams, (err, results) => {
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
          currentPage: currentPage,
          searchQuery: searchQuery,
          searchAction: '/admin-terverifikasi'
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

app.get("/admin-lapak-terblokir", (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 8;
    const offset = (currentPage - 1) * itemsPerPage;
    const searchQuery = req.query.search || "";

    let countQuery = "SELECT COUNT(*) AS count FROM lapak WHERE status_lapak ='terblokir'";
    let dataQuery = `
      SELECT id_lapak, nama_lapak, tanggal_terblokir, lokasi_lapak, status_lapak 
      FROM lapak 
      WHERE status_lapak ='terblokir'
    `;

    if (searchQuery) {
      countQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
      dataQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
    }

    dataQuery += " LIMIT ? OFFSET ?";

    const countParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : [];
    const dataParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`, itemsPerPage, offset] : [itemsPerPage, offset];

    connection.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error("Error executing count query:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalCount = countResult[0].count;
      const pageCount = Math.ceil(totalCount / itemsPerPage);

      connection.query(dataQuery, dataParams, (err, results) => {
        connection.release();

        if (err) {
          console.error("Error executing query:", err.message);
          res.sendStatus(500);
          return;
        }

        results.forEach(lapak => {
          lapak.tanggal_terblokir = moment(lapak.tanggal_terblokir).format('MMMM D, YYYY');
        });

        res.render("admin-lapak-terblokir", {
          pageTitle: 'Daftar Blokir Lapak',
          lapakList: results,
          dataCount: totalCount,
          pageCount: pageCount,
          currentPage: currentPage,
          searchQuery: searchQuery,
          searchAction: '/admin-lapak-terblokir'
        });
      });
    });
  });
});

app.get("/admin-informasi-lapak-terblokir/:id_lapak", (req, res) => {
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
        connection.release();
        return;
      }

      if (lapakResults.length === 0) {
        res.status(404).send("Lapak not found");
        connection.release();
        return;
      }

      const lapak = lapakResults[0];

      if (lapak.status === 'terblokir') {
        const updateStatusQuery = 'UPDATE lapak SET status = ? WHERE id_lapak = ?';
        connection.query(updateStatusQuery, ['terverifikasi', idLapak], (err, updateResult) => {
          if (err) {
            console.error('Error updating lapak status:', err);
            res.status(500).send('Server error');
            connection.release();
            return;
          }

          // Fetch the updated lapak details
          connection.query(lapakQuery, [idLapak], (err, updatedLapakResults) => {
            if (err) {
              console.error('Error fetching updated lapak data:', err);
              res.status(500).send('Server error');
              connection.release();
              return;
            }


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

              updatedLapak.jam_buka = formattedBukaResults;
              res.render("admin-informasi-lapak-terblokir", { lapak: updatedLapak, pageTitle: 'Informasi Blokir Lapak' });
            });
          });
        });
      } else {
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
          res.render("admin-informasi-lapak-terblokir", { lapak, pageTitle: 'Informasi Blokir Lapak' });
        });
      }
    });
  });
});

app.post('/admin-informasi-lapak-terblokir/:id_lapak/accept', (req, res) => {
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
app.get("/admin-lapak-terverifikasi-blokir/:id_lapak", (req, res) => {
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

          res.render("admin-lapak-terverifikasi-blokir", { lapak, laporan: laporanResults, pageTitle: 'Informasi Lapak' });
        });
      });
    });
  });
});

app.post("/admin-lapak-terverifikasi-blokir/:id_lapak/blokir", (req, res) => {
  const idLapak = parseInt(req.params.id_lapak);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).send('Server error');
      return;
    }

    const blokirQuery = 'UPDATE lapak SET status_lapak = "terblokir", tanggal_terblokir = NOW() WHERE id_lapak = ?';
    connection.query(blokirQuery, [idLapak], (err, results) => {
      connection.release();

      if (err) {
        console.error('Error updating lapak status:', err);
        res.status(500).send('Server error');
        return;
      }

      res.send({ success: true });
    });
  });
});


//pembaruan

// Route untuk halaman admin-pembaruan
app.get('/admin-pembaruan', (req, res) => {
  // Mendapatkan halaman saat ini dari query parameter (default: 1)
  const currentPage = parseInt(req.query.page) || 1;

  // Jumlah item per halaman
  const itemsPerPage = 8; // Misalnya 8 item per halaman

  // Query untuk menghitung jumlah total data pembaruan
  let countSql = `
    SELECT COUNT(*) AS total
    FROM pembaruan_lapak p
    JOIN lapak l ON p.id_lapak = l.id_lapak
    WHERE p.status_pembaruan_pembaruan = 'menunggu' AND l.status_lapak = 'terverifikasi'
  `;

  // Query untuk mendapatkan data pembaruan dengan pagination
  let selectSql = `
    SELECT p.*, l.nama_lapak, l.lokasi_lapak
    FROM pembaruan_lapak p
    JOIN lapak l ON p.id_lapak = l.id_lapak
    WHERE p.status_pembaruan_pembaruan = 'menunggu' AND l.status_lapak = 'terverifikasi'
  `;

  const searchQuery = req.query.search || "";
  const searchParams = [`%${searchQuery}%`, `%${searchQuery}%`]; // Placeholder untuk pencarian

  if (searchQuery) {
    countSql += " AND (l.nama_lapak LIKE ? OR l.lokasi_lapak LIKE ?)";
    selectSql += " AND (l.nama_lapak LIKE ? OR l.lokasi_lapak LIKE ?)";
  }

  // Tambahkan ORDER BY dan LIMIT untuk pagination
  selectSql += " ORDER BY p.id_pembaruan DESC";
  selectSql += ` LIMIT ${itemsPerPage} OFFSET ${(currentPage - 1) * itemsPerPage}`;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    // Eksekusi query untuk menghitung jumlah total data
    connection.query(countSql, searchParams, (err, countResult) => {
      if (err) {
        connection.release();
        console.error("Error querying database:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalItems = countResult[0].total;
      const pageCount = Math.ceil(totalItems / itemsPerPage);

      // Eksekusi query untuk mendapatkan data pembaruan dengan pagination
      connection.query(selectSql, searchParams, (err, selectResult) => {
        connection.release();

        if (err) {
          console.error("Error querying database:", err.message);
          res.sendStatus(500);
          return;
        }

        // Render halaman admin-pembaruan dengan data yang sudah diambil
        res.render("admin-pembaruan", {
          pembaruan: selectResult,
          currentPage: currentPage,
          pageCount: pageCount,
          dataCount: totalItems,
          searchQuery: searchQuery,
          searchAction: '/admin-pembaruan',
          pageTitle: 'Daftar Lapak Untuk Diperbarui' // Judul halaman
        });
      });
    });
  });
});




// Route untuk halaman verifikasi pembaruan
app.get('/admin-pembaruan-verif/:id', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const id = req.params.id;
    let sql = `
      SELECT p.*, l.*
      FROM pembaruan_lapak p
      JOIN lapak l ON p.id_lapak = l.id_lapak
      WHERE p.id_pembaruan = ${connection.escape(id)}
    `;

    // Query untuk mendapatkan detail pembaruan lapak
    connection.query(sql, (err, result) => {
      if (err) {
        connection.release();
        console.error("Error querying database:", err.message);
        res.sendStatus(500);
        return;
      }

      if (result.length === 0) {
        connection.release();
        console.log(`Pembaruan dengan ID ${id} tidak ditemukan.`);
        res.sendStatus(404);
        return;
      }

      const lapak = result[0];

      // Query untuk mendapatkan daftar perubahan lapak
      const perubahanQuery = `
        SELECT *
        FROM pembaruan_lapak
        WHERE id_lapak = ${connection.escape(lapak.id_lapak)}
      `;

      // Query untuk mendapatkan jam buka
      const bukaQuery = `
        SELECT hari.nama_hari, buka.jam_buka, buka.jam_tutup
        FROM buka
        JOIN hari ON buka.id_hari = hari.id_hari
        WHERE buka.id_lapak = ?
      `;

      // Query untuk mendapatkan jam buka dari pembaruan
      const bukaPembaruanQuery = `
        SELECT hari.nama_hari, buka_pembaruan.jam_buka, buka_pembaruan.jam_tutup
        FROM buka_pembaruan
        JOIN hari ON buka_pembaruan.id_hari = hari.id_hari
        WHERE buka_pembaruan.id_lapak = ?
      `;

      connection.query(perubahanQuery, (err, perubahanResults) => {
        if (err) {
          console.error('Error fetching perubahan data:', err);
          connection.release();
          res.status(500).send('Server error');
          return;
        }

        lapak.perubahan_lapak = perubahanResults;

        // Query untuk mendapatkan jam buka dari pembaruan
        connection.query(bukaPembaruanQuery, [lapak.id_lapak], (err, bukaPembaruanResults) => {
          if (err) {
            console.error('Error fetching buka_pembaruan data:', err);
            connection.release();
            res.status(500).send('Server error');
            return;
          }

          const formattedBukaPembaruanResults = bukaPembaruanResults.map(result => {
            return {
              hari: result.nama_hari,
              jam_buka: result.jam_buka,
              jam_tutup: result.jam_tutup
            };
          });

          lapak.jam_buka_pembaruan = formattedBukaPembaruanResults;

          // Query untuk mendapatkan jam buka dari lapak (non-pembaruan)
          connection.query(bukaQuery, [lapak.id_lapak], (err, bukaResults) => {
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

            // Render halaman dengan data lapak yang sudah diambil
            res.render("admin-pembaruan-verif", { lapak, pageTitle: 'Daftar Pengajuan Lapak' });
          });
        });
      });
    });
  });
});

// Route untuk menerima pembaruan lapak
app.post('/admin-informasi-lapak-pembaruan/:id/accept', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const id = req.params.id;

    // Query untuk mengambil data perubahan dari pembaruan_lapak
    let selectSql = `SELECT * FROM pembaruan_lapak WHERE id_pembaruan = ${connection.escape(id)}`;
    connection.query(selectSql, (err, results) => {
      if (err) {
        connection.release();
        console.error("Error querying database:", err.message);
        res.sendStatus(500);
        return;
      }

      if (results.length === 0) {
        connection.release();
        console.log(`Pembaruan dengan ID ${id} tidak ditemukan.`);
        res.sendStatus(404);
        return;
      }

      const updateData = results[0];

      // Query untuk memperbarui data lapak berdasarkan perubahan
      let updateSql = `
        UPDATE lapak 
        SET 
          nama_lapak = COALESCE(${connection.escape(updateData.nama_lapak_pembaruan)}, nama_lapak),
          deskripsi_lapak = COALESCE(${connection.escape(updateData.deskripsi_lapak_pembaruan)}, deskripsi_lapak),
          kategori_lapak = COALESCE(${connection.escape(updateData.kategori_lapak_pembaruan)}, kategori_lapak),
          lokasi_lapak = COALESCE(${connection.escape(updateData.lokasi_lapak_pembaruan)}, lokasi_lapak),
          foto_lapak = COALESCE(${connection.escape(updateData.foto_lapak_pembaruan)}, foto_lapak),
          nomor_telepon = COALESCE(${connection.escape(updateData.nomor_telepon_pembaruan)}, nomor_telepon),
          situs = COALESCE(${connection.escape(updateData.situs_pembaruan)}, situs),
          layanan = COALESCE(${connection.escape(updateData.layanan_pembaruan)}, layanan)
        WHERE id_lapak = ${connection.escape(updateData.id_lapak)}
      `;

      connection.query(updateSql, (err, result) => {
        if (err) {
          connection.release();
          console.error("Error updating lapak data:", err.message);
          res.sendStatus(500);
          return;
        }

        // Set status_pembaruan di tabel pembaruan_lapak menjadi 'diterima'
        let updateStatusSql = `UPDATE pembaruan_lapak SET status_pembaruan_pembaruan = 'diterima' WHERE id_pembaruan = ${connection.escape(id)}`;
        connection.query(updateStatusSql, (err, result) => {
          if (err) {
            connection.release();
            console.error("Error updating status pembaruan:", err.message);
            res.sendStatus(500);
            return;
          }

          // Query untuk memperbarui jam buka (buka) berdasarkan pembaruan (buka_pembaruan)
          let updateBukaSql = `
            UPDATE buka
            JOIN buka_pembaruan ON buka.id_lapak = buka_pembaruan.id_lapak AND buka.id_hari = buka_pembaruan.id_hari
            SET 
              buka.jam_buka = buka_pembaruan.jam_buka,
              buka.jam_tutup = buka_pembaruan.jam_tutup
            WHERE buka_pembaruan.id_pembaruan = ${connection.escape(id)}
          `;

          connection.query(updateBukaSql, (err, result) => {
            connection.release();
            if (err) {
              console.error("Error updating jam buka:", err.message);
              res.sendStatus(500);
              return;
            }

            console.log(`Pembaruan dengan ID ${id} telah diterima, data lapak dan jam buka telah diperbarui.`);
            res.redirect('/admin-pembaruan');
          });
        });
      });
    });
  });
});



// Route untuk menolak pembaruan lapak dan redirect ke halaman admin-pengajuan.ejs
app.post('/admin-informasi-lapak-pembaruan/:id/reject', (req, res) => {
  const id = req.params.id;
  let sql = `UPDATE pembaruan_lapak SET status_pembaruan_pembaruan = 'ditolak' WHERE id_pembaruan = ${id}`;
  
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    connection.query(sql, (err, result) => {
      connection.release(); // Memastikan koneksi dilepas setelah penggunaan

      if (err) {
        console.error("Error querying database:", err.message);
        res.sendStatus(500);
        return;
      }

      console.log(`Pembaruan dengan ID ${id} telah ditolak.`);
      res.redirect('/admin-pengajuan'); // Redirect ke halaman admin-pengajuan.ejs setelah berhasil menolak
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
    const searchQuery = req.query.search || "";

    let countQuery = "SELECT COUNT(*) AS count FROM lapak WHERE status_lapak ='menunggu'";
    let dataQuery = `
      SELECT id_lapak, nama_lapak, tanggal_pengajuan, lokasi_lapak, status_lapak 
      FROM lapak 
      WHERE status_lapak ='menunggu' 
    `;

    if (searchQuery) {
      countQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
      dataQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
    }

    dataQuery += " LIMIT ? OFFSET ?";

    const countParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : [];
    const dataParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`, itemsPerPage, offset] : [itemsPerPage, offset];

    connection.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error("Error executing count query:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalCount = countResult[0].count;
      const pageCount = Math.ceil(totalCount / itemsPerPage);

      connection.query(dataQuery, dataParams, (err, results) => {
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
          currentPage: currentPage,
          searchQuery: searchQuery,
          searchAction: '/admin-pengajuan'
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
    const searchQuery = req.query.search || "";

    let countQuery = "SELECT COUNT(*) AS count FROM lapak WHERE status_lapak ='terverifikasi'";
    let dataQuery = `
      SELECT l.id_lapak, l.nama_lapak, l.tanggal_pengajuan, l.lokasi_lapak, l.status_lapak, 
             COALESCE(AVG(u.rating), 0) AS rata_rating,
             (SELECT COUNT(*) FROM laporan r WHERE r.id_lapak = l.id_lapak) AS total_laporan,
             (SELECT COUNT(*) FROM laporan r WHERE r.id_lapak = l.id_lapak AND r.status = 'pending') AS total_laporan_tertunda
      FROM lapak l
      LEFT JOIN ulasan u ON l.id_lapak = u.id_lapak
      WHERE l.status_lapak ='terverifikasi'
    `;

    if (searchQuery) {
      countQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
      dataQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
    }

    dataQuery += " GROUP BY id_lapak, nama_lapak, tanggal_pengajuan, lokasi_lapak, status_lapak LIMIT ? OFFSET ?";

    const countParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : [];
    const dataParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`, itemsPerPage, offset] : [itemsPerPage, offset];

    connection.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error("Error executing count query:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalCount = countResult[0].count;
      const pageCount = Math.ceil(totalCount / itemsPerPage);

      connection.query(dataQuery, dataParams, (err, results) => {
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
          currentPage: currentPage,
          searchQuery: searchQuery,
          searchAction: '/admin-terverifikasi'
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

app.get("/admin-lapak-terblokir", (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      res.sendStatus(500);
      return;
    }

    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 8;
    const offset = (currentPage - 1) * itemsPerPage;
    const searchQuery = req.query.search || "";

    let countQuery = "SELECT COUNT(*) AS count FROM lapak WHERE status_lapak ='terblokir'";
    let dataQuery = `
      SELECT id_lapak, nama_lapak, tanggal_terblokir, lokasi_lapak, status_lapak 
      FROM lapak 
      WHERE status_lapak ='terblokir'
    `;

    if (searchQuery) {
      countQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
      dataQuery += " AND (nama_lapak LIKE ? OR lokasi_lapak LIKE ?)";
    }

    dataQuery += " LIMIT ? OFFSET ?";

    const countParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`] : [];
    const dataParams = searchQuery ? [`%${searchQuery}%`, `%${searchQuery}%`, itemsPerPage, offset] : [itemsPerPage, offset];

    connection.query(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error("Error executing count query:", err.message);
        res.sendStatus(500);
        return;
      }

      const totalCount = countResult[0].count;
      const pageCount = Math.ceil(totalCount / itemsPerPage);

      connection.query(dataQuery, dataParams, (err, results) => {
        connection.release();

        if (err) {
          console.error("Error executing query:", err.message);
          res.sendStatus(500);
          return;
        }

        results.forEach(lapak => {
          lapak.tanggal_terblokir = moment(lapak.tanggal_terblokir).format('MMMM D, YYYY');
        });

        res.render("admin-lapak-terblokir", {
          pageTitle: 'Daftar Blokir Lapak',
          lapakList: results,
          dataCount: totalCount,
          pageCount: pageCount,
          currentPage: currentPage,
          searchQuery: searchQuery,
          searchAction: '/admin-lapak-terblokir'
        });
      });
    });
  });
});

app.get("/admin-informasi-lapak-terblokir/:id_lapak", (req, res) => {
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
        connection.release();
        return;
      }

      if (lapakResults.length === 0) {
        res.status(404).send("Lapak not found");
        connection.release();
        return;
      }

      const lapak = lapakResults[0];

      if (lapak.status === 'terblokir') {
        const updateStatusQuery = 'UPDATE lapak SET status = ? WHERE id_lapak = ?';
        connection.query(updateStatusQuery, ['terverifikasi', idLapak], (err, updateResult) => {
          if (err) {
            console.error('Error updating lapak status:', err);
            res.status(500).send('Server error');
            connection.release();
            return;
          }

          // Fetch the updated lapak details
          connection.query(lapakQuery, [idLapak], (err, updatedLapakResults) => {
            if (err) {
              console.error('Error fetching updated lapak data:', err);
              res.status(500).send('Server error');
              connection.release();
              return;
            }

            
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

              updatedLapak.jam_buka = formattedBukaResults;
              res.render("admin-informasi-lapak-terblokir", { lapak: updatedLapak, pageTitle: 'Informasi Blokir Lapak' });
            });
          });
        });
      } else {
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
          res.render("admin-informasi-lapak-terblokir", { lapak, pageTitle: 'Informasi Blokir Lapak' });
        });
      }
    });
  });
});

app.post('/admin-informasi-lapak-terblokir/:id_lapak/accept', (req, res) => {
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
app.get("/admin-lapak-terverifikasi-blokir/:id_lapak", (req, res) => {
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
          
          res.render("admin-lapak-terverifikasi-blokir", { lapak, laporan: laporanResults, pageTitle: 'Informasi Lapak' });
        });
      });
    });
  });
});

app.post("/admin-lapak-terverifikasi-blokir/:id_lapak/blokir", (req, res) => {
  const idLapak = parseInt(req.params.id_lapak);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to database:', err.message);
      res.status(500).send('Server error');
      return;
    }

    const blokirQuery = 'UPDATE lapak SET status_lapak = "terblokir", tanggal_terblokir = NOW() WHERE id_lapak = ?';
    connection.query(blokirQuery, [idLapak], (err, results) => {
      connection.release();

      if (err) {
        console.error('Error updating lapak status:', err);
        res.status(500).send('Server error');
        return;
      }

      res.send({ success: true });
    });
  });
});
