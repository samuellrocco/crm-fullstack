// server.js — API REST do CRM com dados isolados por visitante (sessão via cookie)
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

const SESSAO_TTL_MS = 24 * 60 * 60 * 1000; // sessões somem após 24h sem uso
const MAX_SESSOES = 500;                   // trava simples contra abuso

app.set("trust proxy", 1); // necessário atrás do proxy do Render (cookie Secure)
app.use(express.json());

// ---------- camada de dados ----------
function lerDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ sessoes: {} }, null, 2));
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  if (!db.sessoes) db.sessoes = {}; // compatível com o db.json antigo
  return db;
}
function salvarDB(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
const uid = () => crypto.randomBytes(6).toString("hex");

// ---------- dados de demonstração ----------
function criarDadosDemo() {
  const c1 = { id: uid(), nome: "Mariana Costa", empresa: "Vértice Engenharia", email: "mariana@vertice.com.br", fone: "(21) 99876-1234" };
  const c2 = { id: uid(), nome: "Rafael Nogueira", empresa: "Atlas Logística", email: "rafael@atlas.com.br", fone: "(11) 98765-4321" };
  const c3 = { id: uid(), nome: "Beatriz Almeida", empresa: "Nova Saúde", email: "bia@novasaude.com.br", fone: "(31) 99123-4567" };
  const negocios = [
    { id: uid(), titulo: "Contrato de manutenção anual", cliente: c1.id, valor: 48000, status: "Negociação" },
    { id: uid(), titulo: "Sistema de rastreamento", cliente: c2.id, valor: 125000, status: "Proposta" },
    { id: uid(), titulo: "Consultoria de processos", cliente: c3.id, valor: 32000, status: "Ganho" },
    { id: uid(), titulo: "Licenças de software", cliente: c1.id, valor: 18500, status: "Lead" },
    { id: uid(), titulo: "Projeto piloto de telemedicina", cliente: c3.id, valor: 67000, status: "Perdido" }
  ];
  return { clientes: [c1, c2, c3], negocios };
}

// ---------- sessão por cookie ----------
function lerSid(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)sid=([a-f0-9]{24})/);
  return m ? m[1] : null;
}

function sessao(req, res, next) {
  // só cria/renova sessão ao abrir a página e nas chamadas da API
  const p = req.path;
  if (!(p === "/" || p === "/index.html" || p.startsWith("/api"))) return next();

  const db = lerDB();
  let sid = lerSid(req);

  if (!sid || !db.sessoes[sid]) {
    // limpa sessões expiradas e aplica o limite antes de criar uma nova
    const agora = Date.now();
    for (const [id, s] of Object.entries(db.sessoes)) {
      if (agora - s.ultimoAcesso > SESSAO_TTL_MS) delete db.sessoes[id];
    }
    const ids = Object.keys(db.sessoes);
    if (ids.length >= MAX_SESSOES) {
      ids.sort((a, b) => db.sessoes[a].ultimoAcesso - db.sessoes[b].ultimoAcesso);
      delete db.sessoes[ids[0]];
    }
    sid = crypto.randomBytes(12).toString("hex"); // 24 caracteres hex
    db.sessoes[sid] = { ...criarDadosDemo(), ultimoAcesso: agora };
  } else {
    db.sessoes[sid].ultimoAcesso = Date.now();
  }
  salvarDB(db);

  res.setHeader("Set-Cookie",
    `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSAO_TTL_MS / 1000}${req.secure ? "; Secure" : ""}`);
  req.sid = sid;
  next();
}
app.use(sessao);
app.use(express.static(path.join(__dirname, "public")));

// pega o banco e o "espaço" do visitante atual
function contexto(req) {
  const db = lerDB();
  return { db, s: db.sessoes[req.sid] };
}

// ---------- reset da demonstração ----------
app.post("/api/reset", (req, res) => {
  const { db, s } = contexto(req);
  Object.assign(s, criarDadosDemo());
  salvarDB(db);
  res.json({ ok: true });
});

// ---------- clientes ----------
app.get("/api/clientes", (req, res) => {
  res.json(contexto(req).s.clientes);
});

app.post("/api/clientes", (req, res) => {
  const { nome, empresa, email, fone } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
  const { db, s } = contexto(req);
  const cliente = { id: uid(), nome: nome.trim(), empresa: empresa || "", email: email || "", fone: fone || "" };
  s.clientes.push(cliente);
  salvarDB(db);
  res.status(201).json(cliente);
});

app.put("/api/clientes/:id", (req, res) => {
  const { db, s } = contexto(req);
  const idx = s.clientes.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Cliente não encontrado." });
  s.clientes[idx] = { ...s.clientes[idx], ...req.body, id: req.params.id };
  salvarDB(db);
  res.json(s.clientes[idx]);
});

app.delete("/api/clientes/:id", (req, res) => {
  const { db, s } = contexto(req);
  s.clientes = s.clientes.filter(c => c.id !== req.params.id);
  salvarDB(db);
  res.status(204).end();
});

// ---------- negócios ----------
app.get("/api/negocios", (req, res) => {
  res.json(contexto(req).s.negocios);
});

app.post("/api/negocios", (req, res) => {
  const { titulo, cliente, valor, status } = req.body;
  if (!titulo || !titulo.trim()) return res.status(400).json({ erro: "O campo 'titulo' é obrigatório." });
  const { db, s } = contexto(req);
  const negocio = { id: uid(), titulo: titulo.trim(), cliente: cliente || "", valor: Number(valor) || 0, status: status || "Lead" };
  s.negocios.push(negocio);
  salvarDB(db);
  res.status(201).json(negocio);
});

app.put("/api/negocios/:id", (req, res) => {
  const { db, s } = contexto(req);
  const idx = s.negocios.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Negócio não encontrado." });
  s.negocios[idx] = { ...s.negocios[idx], ...req.body, id: req.params.id };
  salvarDB(db);
  res.json(s.negocios[idx]);
});

app.delete("/api/negocios/:id", (req, res) => {
  const { db, s } = contexto(req);
  s.negocios = s.negocios.filter(n => n.id !== req.params.id);
  salvarDB(db);
  res.status(204).end();
});

app.listen(PORT, () => console.log(`CRM rodando em http://localhost:${PORT}`));
