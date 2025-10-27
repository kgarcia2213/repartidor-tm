import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();
const app = express();
//app.use(cors());
//app.use(express.json());
const allowedOrigins = [
  "https://repartidor-pwa.onrender.com",  // tu frontend en Render
  "https://repartidor-admin.onrender.com", // tu front end admin en render
  "http://localhost:5173" // para pruebas locales, si usas Vite o similar
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS bloqueado por política de seguridad"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));


// ---------------------- LOGIN ----------------------
app.post("/api/login", async (req, res) => {
  const { id } = req.body;
  try {
    console.log("ID recibido:", id);
    const result = await pool.query("SELECT * FROM repartidores WHERE id = $1", [id]);
      console.log("Resultado:", result.rows);
    if (result.rows.length === 0) return res.status(404).json({ message: "Repartidor no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
      console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------- PEDIDOS PENDIENTES ----------------------
app.get("/api/pedidos/asignados/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.estado = 'Pendiente'
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------- DETALLE PEDIDO ----------------------
app.get("/api/pedidos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.direccion as cliente_direccion
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Pedido no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------- CONFIRMAR ENTREGA ----------------------
app.post("/api/entregas/confirmar", async (req, res) => {
  const { pedido_id, repartidor_id, firma_foto, comentario } = req.body;
  try {
    await pool.query(`
      INSERT INTO entregas (pedido_id, repartidor_id, fecha_salida, fecha_entrega, firma_foto, status, comentario)
      VALUES ($1, $2, NOW(), NOW(), $3, 'Entregado', $4)
    `, [pedido_id, repartidor_id, firma_foto, comentario]);
    await pool.query("UPDATE pedidos SET estado = 'Entregado' WHERE id = $1", [pedido_id]);
    res.json({ message: "Entrega confirmada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------- HISTORIAL ----------------------
app.get("/api/historial/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT e.*, p.direccion, c.nombre as cliente_nombre
      FROM entregas e
      JOIN pedidos p ON e.pedido_id = p.id
      JOIN clientes c ON p.cliente_id = c.id
      WHERE e.repartidor_id = $1
      ORDER BY e.fecha_entrega DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ CRUD clientes
app.get("/api/clientes", async (_, res) => {
  const r = await pool.query("SELECT * FROM clientes ORDER BY id DESC");
  res.json(r.rows);
});
app.post("/api/clientes", async (req, res) => {
  const { nombre, telefono, direccion } = req.body;
  await pool.query(
    "INSERT INTO clientes (nombre, telefono, direccion) VALUES ($1,$2,$3)",
    [nombre, telefono, direccion]
  );
  res.json({ message: "Cliente agregado" });
});

// ✅ CRUD repartidores
app.get("/api/repartidores", async (_, res) => {
  const r = await pool.query("SELECT * FROM repartidores ORDER BY id DESC");
  res.json(r.rows);
});
app.post("/api/repartidores", async (req, res) => {
  const { nombre, telefono } = req.body;
  await pool.query(
    "INSERT INTO repartidores (nombre, telefono) VALUES ($1,$2)",
    [nombre, telefono]
  );
  res.json({ message: "Repartidor agregado" });
});

// ✅ CRUD pedidos
app.get("/api/pedidos", async (_, res) => {
  const r = await pool.query(`
    SELECT p.*, c.nombre as cliente, r.nombre as repartidor
    FROM pedidos p
    LEFT JOIN clientes c ON p.cliente_id = c.id
    LEFT JOIN repartidores r ON p.repartidor_id = r.id
    ORDER BY p.id DESC
  `);
  res.json(r.rows);
});
app.post("/api/pedidos", async (req, res) => {
  const { cliente_id, repartidor_id, direccion } = req.body;
  await pool.query(
    "INSERT INTO pedidos (cliente_id, repartidor_id, direccion) VALUES ($1,$2,$3)",
    [cliente_id, repartidor_id, direccion]
  );
  res.json({ message: "Pedido creado" });
});

// ---------------------- INICIAR SERVIDOR ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
