// app.js — frontend consumindo a API REST em /api/clientes e /api/negocios

const ETAPAS = ["Lead", "Proposta", "Negociação", "Ganho", "Perdido"];
let clientes = [], negocios = [];
const $ = s => document.querySelector(s);
const brl = n => "R$ " + (+n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ---------- chamadas à API ----------
async function api(path, options = {}) {
  const res = await fetch("/api/" + path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok && res.status !== 204) {
    const erro = await res.json().catch(() => ({}));
    throw new Error(erro.erro || "Erro na requisição.");
  }
  return res.status === 204 ? null : res.json();
}

async function carregar() {
  try {
    [clientes, negocios] = await Promise.all([api("clientes"), api("negocios")]);
    $("#foot").textContent = "Conectado à API.";
  } catch (e) {
    $("#foot").textContent = "Não foi possível conectar ao servidor.";
    console.error(e);
  }
  render();
}

// ---------- navegação ----------
document.querySelectorAll(".side nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".side nav button").forEach(x => x.classList.toggle("on", x === b));
  ["dash", "cli", "neg"].forEach(id => $("#" + id).hidden = id !== b.dataset.t);
});

// ---------- clientes ----------
$("#fc").onsubmit = async e => {
  e.preventDefault();
  const f = e.target;
  const payload = {
    nome: f.nome.value.trim(),
    empresa: f.empresa.value.trim(),
    email: f.email.value.trim(),
    fone: f.fone.value.trim()
  };
  if (!payload.nome) return;
  try {
    const criado = await api("clientes", { method: "POST", body: JSON.stringify(payload) });
    clientes.push(criado);
    f.reset();
    render();
  } catch (e) { alert(e.message); }
};

async function delCli(id) {
  clientes = clientes.filter(c => c.id !== id);
  render();
  try { await api("clientes/" + id, { method: "DELETE" }); }
  catch (e) { alert(e.message); carregar(); }
}

// ---------- negócios ----------
$("#fn").onsubmit = async e => {
  e.preventDefault();
  const f = e.target;
  const payload = {
    titulo: f.titulo.value.trim(),
    cliente: f.cliente.value,
    valor: Number(f.valor.value) || 0,
    status: f.status.value
  };
  if (!payload.titulo) return;
  try {
    const criado = await api("negocios", { method: "POST", body: JSON.stringify(payload) });
    negocios.push(criado);
    f.reset();
    render();
  } catch (e) { alert(e.message); }
};

async function delNeg(id) {
  negocios = negocios.filter(n => n.id !== id);
  render();
  try { await api("negocios/" + id, { method: "DELETE" }); }
  catch (e) { alert(e.message); carregar(); }
}

async function mudaStatus(id, status) {
  const n = negocios.find(x => x.id === id);
  if (!n) return;
  n.status = status;
  render();
  try { await api("negocios/" + id, { method: "PUT", body: JSON.stringify({ status }) }); }
  catch (e) { alert(e.message); carregar(); }
}

// ---------- renderização ----------
function render() {
  const abertos = negocios.filter(n => n.status !== "Ganho" && n.status !== "Perdido");
  $("#s1").textContent = clientes.length;
  $("#s2").textContent = abertos.length;
  $("#s3").textContent = brl(abertos.reduce((s, n) => s + n.valor, 0));
  $("#s4").textContent = brl(negocios.filter(n => n.status === "Ganho").reduce((s, n) => s + n.valor, 0));

  const max = Math.max(1, ...ETAPAS.map(e => negocios.filter(n => n.status === e).length));
  $("#funil").innerHTML = ETAPAS.map(e => {
    const q = negocios.filter(n => n.status === e);
    const t = q.reduce((s, n) => s + n.valor, 0);
    return `<div class="rowp"><span>${e}</span><div class="bar"><span style="width:${q.length / max * 100}%"></span></div><span class="num">${q.length} · ${brl(t)}</span></div>`;
  }).join("");

  $("#ec").hidden = clientes.length > 0;
  $("#tc").innerHTML = clientes.map(c => {
    const q = negocios.filter(n => n.cliente === c.id).length;
    const ct = [c.email, c.fone].filter(Boolean).join(" · ") || "—";
    return `<tr><td><strong>${esc(c.nome)}</strong></td><td>${esc(c.empresa) || "—"}</td><td>${esc(ct)}</td>
      <td class="num">${q}</td><td><button class="x" data-del-c="${c.id}">Excluir</button></td></tr>`;
  }).join("");

  $("#selc").innerHTML = '<option value="">Sem cliente</option>' + clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("");

  $("#en").hidden = negocios.length > 0;
  $("#tn").innerHTML = negocios.map(n => {
    const c = clientes.find(x => x.id === n.cliente);
    const cls = n.status === "Ganho" ? "ganho" : n.status === "Perdido" ? "perdido" : "";
    return `<tr><td><strong>${esc(n.titulo)}</strong></td><td>${c ? esc(c.nome) : "—"}</td><td class="num">${brl(n.valor)}</td>
      <td><select data-st="${n.id}" style="padding:3px 6px;font-size:.78rem;width:auto;display:inline-block">${ETAPAS.map(e => `<option${e === n.status ? " selected" : ""}>${e}</option>`).join("")}</select>
      <span class="status ${cls}" style="margin-left:6px">${n.status}</span></td>
      <td><button class="x" data-del-n="${n.id}">Excluir</button></td></tr>`;
  }).join("");
}
function esc(s) { return String(s || "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])); }

document.addEventListener("click", e => {
  const a = e.target.dataset.delC, b = e.target.dataset.delN;
  if (a && confirm("Excluir este cliente?")) delCli(a);
  if (b && confirm("Excluir este negócio?")) delNeg(b);
});
document.addEventListener("change", e => { if (e.target.dataset.st) mudaStatus(e.target.dataset.st, e.target.value); });

render();
carregar();
