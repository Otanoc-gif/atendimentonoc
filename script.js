import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "./firebase.js";

const STORAGE_KEYS = {
  atendimentos: "noc_atendimentos",
  turno: "noc_passagem_turno",
  alertas: "noc_alertas",
  links: "noc_monitor_links"
};

const tipos = [
  "Segunda via", "Sem conexão", "Lentidão", "Wi-Fi instável",
  "Dúvida", "Suporte geral", "Rompimento", "Visita técnica",
  "Financeiro", "Cancelamento", "Retorno ao cliente"
];

const statusList = [
  "Resolvido", "Pendente", "Aguardando cliente",
  "Encaminhado para técnico", "Em acompanhamento",
  "Rompimento ativo", "Visita agendada", "Cancelado"
];

const mensagens = {
  "Saudação": "Olá, tudo bem? Aqui é do suporte técnico. Como posso ajudar?",
  "Segunda via": "Claro, vou verificar a possibilidade de envio da segunda via. Lembrando que não é necessário informar dados sensíveis por aqui.",
  "Sem conexão": "Entendi. Vamos realizar algumas verificações iniciais para identificar se é falha no equipamento, sinal ou alguma instabilidade na região.",
  "Lentidão": "Entendi. Para analisarmos melhor a lentidão, vamos validar alguns pontos como teste de conexão, Wi-Fi, equipamento e horário em que o problema ocorre.",
  "Rompimento": "Identificamos uma possível ocorrência externa afetando a conexão na região. Nossa equipe está acompanhando a situação para normalização o quanto antes.",
  "Manutenção": "Estamos em processo de manutenção/verificação técnica. Assim que houver atualização, o atendimento será acompanhado.",
  "Aguardando retorno": "Ficamos no aguardo do seu retorno com as informações solicitadas para darmos continuidade ao atendimento.",
  "Encerramento": "Como as orientações foram repassadas e o atendimento registrado, vamos encerrar este contato. Permanecemos à disposição.",
  "Sem acesso remoto": "No momento estamos sem acesso remoto ao equipamento, por isso o atendimento será registrado para análise e acompanhamento técnico.",
  "Visita técnica": "Será necessário encaminhar para visita técnica, onde a equipe poderá verificar presencialmente os equipamentos, sinal e estrutura interna."
};

function $(id) {
  return document.getElementById(id);
}

function getData(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function nowBR() {
  return new Date().toLocaleString("pt-BR");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalize(text) {
  return (text || "").toString().trim().toLowerCase();
}

function showToast(msg = "Copiado!") {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function copyText(text) {
  navigator.clipboard.writeText(text || "").then(() => showToast("Copiado!"));
}

function fillSelect(select, options, includeAll = false) {
  select.innerHTML = "";

  if (includeAll) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Todos";
    select.appendChild(opt);
  }

  options.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

function updateClock() {
  if ($("dataHora")) $("dataHora").value = nowBR();
}

function getFormData() {
  return {
    criadoEm: new Date().toISOString(),
    dataHora: $("dataHora").value,
    cliente: $("cliente").value.trim(),
    bairro: $("bairro").value.trim(),
    tipo: $("tipo").value,
    subtipo: $("subtipo").value.trim(),
    resumo: $("resumo").value.trim(),
    testes: $("testes").value.trim(),
    diagnostico: $("diagnostico").value.trim(),
    acao: $("acao").value.trim(),
    status: $("status").value,
    atendente: $("atendente").value.trim()
  };
}

function gerarTextoOS(data = getFormData()) {
  const cliente = data.cliente ? `Cliente/código interno: ${data.cliente}. ` : "";
  const bairro = data.bairro ? `Bairro informado: ${data.bairro}. ` : "";
  const subtipo = data.subtipo ? `Subtipo/observação: ${data.subtipo}. ` : "";

  const resumo = data.resumo || `Cliente entrou em contato referente a ${data.tipo.toLowerCase()}.`;
  const testes = data.testes || "Foram realizadas verificações iniciais conforme disponibilidade do atendimento.";
  const diagnostico = data.diagnostico || "Diagnóstico provável ainda em análise.";
  const acao = data.acao || "Atendimento registrado para acompanhamento.";
  const status = data.status ? `Status atual: ${data.status}.` : "";

  return `${cliente}${bairro}${resumo} ${subtipo}Testes/validações realizadas: ${testes}. Diagnóstico provável: ${diagnostico}. Ação tomada: ${acao}. ${status}`
    .replace(/\s+/g, " ")
    .trim();
}

async function salvarAtendimento(e) {
  e.preventDefault();

  const data = getFormData();

  data.criadoFirebase = serverTimestamp();
  data.usuarioEmail = auth.currentUser ? auth.currentUser.email : "não identificado";

  await addDoc(collection(db, "atendimentos"), data);

  $("textoOS").value = gerarTextoOS(data);

  await carregarAtendimentosFirebase();

  showToast("Atendimento salvo no Firebase!");
}

async function carregarAtendimentosFirebase() {
  const q = query(collection(db, "atendimentos"), orderBy("criadoEm", "desc"));
  const snapshot = await getDocs(q);

  const registros = [];

  snapshot.forEach(docSnap => {
    registros.push({
      firebaseId: docSnap.id,
      ...docSnap.data()
    });
  });

  setData(STORAGE_KEYS.atendimentos, registros);
  renderAll();
}

function limparFormulario() {
  [
    "cliente", "bairro", "subtipo", "resumo",
    "testes", "diagnostico", "acao", "atendente"
  ].forEach(id => {
    if ($(id)) $(id).value = "";
  });

  $("status").value = "Resolvido";
  $("tipo").value = "Segunda via";
  $("textoOS").value = "";
  updateClock();
}

function renderUltimos() {
  const list = $("ultimosAtendimentos");
  if (!list) return;

  const registros = getData(STORAGE_KEYS.atendimentos).slice(0, 5);

  if (!registros.length) {
    list.innerHTML = "<p>Nenhum atendimento salvo ainda.</p>";
    return;
  }

  list.innerHTML = registros.map(r => `
    <div class="mini-item">
      <strong>${r.tipo}</strong> - ${r.status}<br>
      <span>${r.dataHora}</span><br>
      <small>${r.cliente || "Sem identificação"} ${r.bairro ? " • " + r.bairro : ""}</small>
    </div>
  `).join("");
}

function renderMensagens() {
  const container = $("mensagensProntas");
  if (!container) return;

  container.innerHTML = Object.entries(mensagens).map(([titulo, texto]) => `
    <div class="card message-card">
      <h3>${titulo}</h3>
      <p>${texto}</p>
      <button onclick='copyText(${JSON.stringify(texto)})'>Copiar ${titulo}</button>
    </div>
  `).join("");
}

function filteredAtendimentos() {
  const data = $("filtroData")?.value || "";
  const tipo = $("filtroTipo")?.value || "";
  const status = $("filtroStatus")?.value || "";
  const atendente = normalize($("filtroAtendente")?.value || "");

  return getData(STORAGE_KEYS.atendimentos).filter(r => {
    const dia = r.criadoEm ? r.criadoEm.slice(0, 10) : "";
    return (!data || dia === data)
      && (!tipo || r.tipo === tipo)
      && (!status || r.status === status)
      && (!atendente || normalize(r.atendente).includes(atendente));
  });
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "Não informado";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderCounters(containerId, data) {
  const container = $(containerId);
  if (!container) return;

  const entries = Object.entries(data);

  container.innerHTML = entries.length
    ? entries.map(([k, v]) => `
      <div class="bar-row">
        <span>${k}</span>
        <strong>${v}</strong>
      </div>
    `).join("")
    : "<p>Nenhum registro encontrado.</p>";
}

function renderRelatorio() {
  if (!$("totalDia")) return;

  const rows = filteredAtendimentos();

  $("totalDia").textContent = rows.length;
  $("totalPendentes").textContent = rows.filter(r => r.status !== "Resolvido" && r.status !== "Cancelado").length;
  $("totalResolvidos").textContent = rows.filter(r => r.status === "Resolvido").length;

  renderCounters("porTipo", countBy(rows, "tipo"));
  renderCounters("porStatus", countBy(rows, "status"));

  if (!rows.length) {
    $("listaRelatorio").innerHTML = "<p>Nenhum atendimento encontrado com os filtros atuais.</p>";
    return;
  }

  $("listaRelatorio").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Cliente</th>
          <th>Bairro</th>
          <th>Tipo</th>
          <th>Status</th>
          <th>Atendente</th>
          <th>Resumo</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.dataHora || "-"}</td>
            <td>${r.cliente || "-"}</td>
            <td>${r.bairro || "-"}</td>
            <td>${r.tipo || "-"}</td>
            <td>${r.status || "-"}</td>
            <td>${r.atendente || "-"}</td>
            <td>${r.resumo || "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function gerarRelatorioTexto() {
  const rows = filteredAtendimentos();
  const porTipo = countBy(rows, "tipo");
  const porStatus = countBy(rows, "status");

  return [
    "RELATÓRIO DIÁRIO DE ATENDIMENTOS",
    `Data do filtro: ${$("filtroData").value || "Todos os dias"}`,
    `Total de atendimentos: ${rows.length}`,
    "",
    "Quantidade por tipo:",
    ...Object.entries(porTipo).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Quantidade por status:",
    ...Object.entries(porStatus).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Clientes/códigos atendidos:",
    ...rows.map(r => `- ${r.cliente || "Sem identificação"} | ${r.tipo} | ${r.status} | ${r.atendente || "Sem atendente"}`)
  ].join("\n");
}

function exportCSV() {
  const rows = filteredAtendimentos();

  const headers = [
    "Data/Hora", "Cliente/Código", "Bairro", "Tipo", "Subtipo",
    "Resumo", "Testes", "Diagnóstico", "Ação", "Status", "Atendente"
  ];

  const csvRows = [
    headers.join(";"),
    ...rows.map(r => [
      r.dataHora, r.cliente, r.bairro, r.tipo, r.subtipo,
      r.resumo, r.testes, r.diagnostico, r.acao, r.status, r.atendente
    ].map(v => `"${String(v || "").replaceAll('"', '""')}"`).join(";"))
  ];

  const blob = new Blob(["\ufeff" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `relatorio-atendimentos-${todayISO()}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

function salvarTurno() {
  const data = {
    pendentes: $("turnoPendentes").value,
    retorno: $("turnoRetorno").value,
    rompimentos: $("turnoRompimentos").value,
    tecnicos: $("turnoTecnicos").value,
    obs: $("turnoObs").value,
    atualizadoEm: nowBR()
  };

  setData(STORAGE_KEYS.turno, data);
  showToast("Passagem salva!");
}

function carregarTurno() {
  const t = getData(STORAGE_KEYS.turno, {});

  $("turnoPendentes").value = t.pendentes || "";
  $("turnoRetorno").value = t.retorno || "";
  $("turnoRompimentos").value = t.rompimentos || "";
  $("turnoTecnicos").value = t.tecnicos || "";
  $("turnoObs").value = t.obs || "";
}

function textoTurno() {
  return [
    "PASSAGEM DE TURNO",
    `Atualizado em: ${nowBR()}`,
    "",
    "Clientes pendentes:",
    $("turnoPendentes").value || "-",
    "",
    "Clientes para retorno:",
    $("turnoRetorno").value || "-",
    "",
    "Rompimentos ativos:",
    $("turnoRompimentos").value || "-",
    "",
    "Técnicos em campo:",
    $("turnoTecnicos").value || "-",
    "",
    "Observações importantes:",
    $("turnoObs").value || "-"
  ].join("\n");
}

function gerarPassagemPelosRegistros() {
  const rows = filteredAtendimentos();

  const pendentes = rows.filter(r => r.status !== "Resolvido" && r.status !== "Cancelado");

  $("turnoPendentes").value = pendentes
    .map(r => `${r.cliente || "Sem identificação"} | ${r.tipo} | ${r.status}`)
    .join("\n");

  $("turnoRetorno").value = rows
    .filter(r => r.tipo === "Retorno ao cliente" || r.status === "Aguardando cliente")
    .map(r => `${r.cliente || "Sem identificação"} | ${r.resumo || r.tipo}`)
    .join("\n");

  $("turnoRompimentos").value = rows
    .filter(r => r.tipo === "Rompimento" || r.status === "Rompimento ativo")
    .map(r => `${r.bairro || "Bairro não informado"} | ${r.resumo || "Rompimento/impacto em análise"}`)
    .join("\n");

  salvarTurno();
  showView("turno");
}

function renderAlertas() {
  const lista = $("alertasLista");
  if (!lista) return;

  const alertas = getData(STORAGE_KEYS.alertas);

  lista.innerHTML = alertas.length
    ? alertas.map(a => `
      <div class="mini-item">
        <strong>${a.pop || "POP não informado"}</strong> • ${a.horario || "-"}<br>
        Bairro: ${a.bairro || "-"}<br>
        Impacto: ${a.impacto || "-"}<br>
        <small>${a.descricao || ""}</small>
      </div>
    `).join("")
    : "<p>Nenhum alerta manual registrado.</p>";
}

function salvarAlerta(e) {
  e.preventDefault();

  const alertas = getData(STORAGE_KEYS.alertas);

  alertas.unshift({
    id: crypto.randomUUID(),
    pop: $("popAfetado").value.trim(),
    bairro: $("bairroAfetado").value.trim(),
    horario: $("horarioAlerta").value,
    impacto: $("impactoObservado").value.trim(),
    descricao: $("descricaoAlerta").value.trim(),
    criadoEm: new Date().toISOString()
  });

  setData(STORAGE_KEYS.alertas, alertas);

  e.target.reset();
  renderAlertas();
  showToast("Alerta salvo!");
}

function loadLinks() {
  const links = getData(STORAGE_KEYS.links, {
    zabbix: "https://zabbix.com",
    grafana: "https://grafana.com"
  });

  const anchors = document.querySelectorAll(".quick-links a");

  if (anchors[0]) anchors[0].href = links.zabbix || "https://zabbix.com";
  if (anchors[1]) anchors[1].href = links.grafana || "https://grafana.com";
}

function setMonitorLink(type) {
  const atual = getData(STORAGE_KEYS.links, {});
  const key = type.toLowerCase();

  const valor = prompt(`Informe o link do ${type}:`, atual[key] || "");

  if (!valor) return;

  atual[key] = valor;
  setData(STORAGE_KEYS.links, atual);
  loadLinks();
}

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  $(id).classList.add("active");

  const btn = document.querySelector(`[data-view="${id}"]`);
  if (btn) btn.classList.add("active");
}

function apagarRegistrosDia() {
  if (!confirm("Apagar todos os registros de hoje?")) return;

  const hoje = todayISO();

  const restantes = getData(STORAGE_KEYS.atendimentos)
    .filter(r => r.criadoEm.slice(0, 10) !== hoje);

  setData(STORAGE_KEYS.atendimentos, restantes);
  renderAll();
}

function clearAllStorage() {
  if (!confirm("Isso apagará todos os dados locais deste sistema neste navegador. Continuar?")) return;

  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));

  renderAll();
  carregarTurno();
  loadLinks();
}

function renderAll() {
  renderUltimos();
  renderRelatorio();
  renderAlertas();
}

function init() {
  fillSelect($("tipo"), tipos);
  fillSelect($("filtroTipo"), tipos, true);
  fillSelect($("filtroStatus"), statusList, true);

  $("filtroData").value = todayISO();

  updateClock();
  setInterval(updateClock, 1000);

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  $("ticketForm").addEventListener("submit", salvarAtendimento);

  $("gerarOS").addEventListener("click", () => {
    $("textoOS").value = gerarTextoOS();
  });

  $("limparForm").addEventListener("click", limparFormulario);

  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      copyText($(btn.dataset.copy).value);
    });
  });

  ["filtroData", "filtroTipo", "filtroStatus", "filtroAtendente"].forEach(id => {
    $(id).addEventListener("input", renderRelatorio);
  });

  $("limparFiltros").addEventListener("click", () => {
    $("filtroData").value = todayISO();
    $("filtroTipo").value = "";
    $("filtroStatus").value = "";
    $("filtroAtendente").value = "";
    renderRelatorio();
  });

  $("copiarRelatorio").addEventListener("click", () => copyText(gerarRelatorioTexto()));
  $("exportarCSV").addEventListener("click", exportCSV);
  $("imprimirRelatorio").addEventListener("click", () => window.print());
  $("gerarPassagem").addEventListener("click", gerarPassagemPelosRegistros);

  $("salvarTurno").addEventListener("click", salvarTurno);
  $("copiarTurno").addEventListener("click", () => copyText(textoTurno()));

  $("limparTurno").addEventListener("click", () => {
    ["turnoPendentes", "turnoRetorno", "turnoRompimentos", "turnoTecnicos", "turnoObs"].forEach(id => {
      $(id).value = "";
    });

    salvarTurno();
  });

  $("alertForm").addEventListener("submit", salvarAlerta);

  $("addZabbixLink").addEventListener("click", () => setMonitorLink("Zabbix"));
  $("addGrafanaLink").addEventListener("click", () => setMonitorLink("Grafana"));

  $("apagarDia").addEventListener("click", apagarRegistrosDia);
  $("limparStorage").addEventListener("click", clearAllStorage);

  renderMensagens();
  carregarTurno();
  loadLinks();
  renderAll();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    await carregarAtendimentosFirebase();
  });
}

window.copyText = copyText;

document.addEventListener("DOMContentLoaded", init);

let filaAtendimentos =
JSON.parse(localStorage.getItem("filaAtendimentos")) || [];

function salvarFila(){
    localStorage.setItem(
        "filaAtendimentos",
        JSON.stringify(filaAtendimentos)
    );

    renderFila();
}

function adicionarFila(){

    const cliente =
    document.getElementById("filaCliente").value;

    const tipo =
    document.getElementById("filaTipo").value;

    if(!cliente){
        alert("Informe o cliente.");
        return;
    }

    filaAtendimentos.push({
        id:Date.now(),
        cliente,
        tipo,
        inicio:new Date().getTime()
    });

    document.getElementById("filaCliente").value="";

    salvarFila();
}

function finalizarFila(id){

    filaAtendimentos =
    filaAtendimentos.filter(x=>x.id!==id);

    salvarFila();
}

function renderFila(){

    const container =
    document.getElementById("filaContainer");

    if(!container) return;

    container.innerHTML="";

    filaAtendimentos.forEach(item=>{

        const minutos =
        Math.floor(
            (Date.now()-item.inicio)/60000
        );

        const segundos =
        Math.floor(
            ((Date.now()-item.inicio)%60000)/1000
        );

        let classe="fila-normal";

        if(minutos>=2)
            classe="fila-alerta";

        if(minutos>=5)
            classe="fila-critico";

        const div =
        document.createElement("div");

        div.className="fila-card";

        div.innerHTML=`
            <div class="fila-header">
                <h3>${item.cliente}</h3>
                <span>${item.tipo}</span>
            </div>

            <div class="fila-tempo ${classe}">
                ${String(minutos).padStart(2,'0')}
                :
                ${String(segundos).padStart(2,'0')}
            </div>

            <div class="fila-botoes">
                <button onclick="finalizarFila(${item.id})">
                    Finalizar
                </button>
            </div>
        `;

        container.appendChild(div);
    });
}

document
.getElementById("adicionarFila")
?.addEventListener("click", adicionarFila);

window.finalizarFila = finalizarFila;

setInterval(renderFila,1000);

renderFila();
