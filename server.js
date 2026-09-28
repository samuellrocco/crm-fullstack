// server.js — API REST do CRM (clientes e negócios)
// Persistência simples em arquivo JSON (data/db.json).
// Para trocar por um banco de verdade (Postgres, MySQL, MongoDB...),
// troque só as funções lerDB()/salvarDB() e as rotas continuam iguais.

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- camada de dados ----------
function lerDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ clientes: [], negocios: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function salvarDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
// ---------- rotas: clientes ----------
app.get("/api/clientes", (req, res) => {
  const db = lerDB();
  res.json(db.clientes);
});

app.post("/api/clientes", (req, res) => {
  const { nome, empresa, email, fone } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
  }
  const db = lerDB();
  const cliente = { id: uid(), nome: nome.trim(), empresa: empresa || "", email: email || "", fone: fone || "" };
  db.clientes.push(cliente);
  salvarDB(db);
  res.status(201).json(cliente);
});

app.put("/api/clientes/:id", (req, res) => {
  const db = lerDB();
  const idx = db.clientes.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Cliente não encontrado." });
  db.clientes[idx] = { ...db.clientes[idx], ...req.body, id: req.params.id };
  salvarDB(db);
  res.json(db.clientes[idx]);
});

app.delete("/api/clientes/:id", (req, res) => {
  const db = lerDB();
  db.clientes = db.clientes.filter(c => c.id !== req.params.id);
  salvarDB(db);
  res.status(204).end();
});

// ---------- rotas: negócios ----------
app.get("/api/negocios", (req, res) => {
  const db = lerDB();
  res.json(db.negocios);
});

app.post("/api/negocios", (req, res) => {
  const { titulo, cliente, valor, status } = req.body;
  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ erro: "O campo 'titulo' é obrigatório." });
  }
  const db = lerDB();
  const negocio = {
    id: uid(),
    titulo: titulo.trim(),
    cliente: cliente || "",
    valor: Number(valor) || 0,
    status: status || "Lead"
  };
  db.negocios.push(negocio);
  salvarDB(db);
  res.status(201).json(negocio);
});

app.put("/api/negocios/:id", (req, res) => {
  const db = lerDB();
  const idx = db.negocios.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Negócio não encontrado." });
  db.negocios[idx] = { ...db.negocios[idx], ...req.body, id: req.params.id };
  salvarDB(db);
  res.json(db.negocios[idx]);
});

app.delete("/api/negocios/:id", (req, res) => {
  const db = lerDB();
  db.negocios = db.negocios.filter(n => n.id !== req.params.id);
  salvarDB(db);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`CRM rodando em http://localhost:${PORT}`);
});
