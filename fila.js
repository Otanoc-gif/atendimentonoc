const FILA_KEY = "atnoc_fila_atendimentos";
const FILA_FINALIZADOS_KEY = "atnoc_fila_finalizados";

let filaAtendimentos = JSON.parse(localStorage.getItem(FILA_KEY)) || [];
let filaFinalizados = JSON.parse(localStorage.getItem(FILA_FINALIZADOS_KEY)) || [];
let filaSelecionadaId = null;
let audioLiberado = false;

function filaSalvar() {
  localStorage.setItem(FILA_KEY, JSON.stringify(filaAtendimentos));
}

function filaSalvarFinalizados() {
  localStorage.setItem(FILA_FINALIZADOS_KEY, JSON.stringify(filaFinalizados));
}

function filaFormatarTempo(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function filaTocarSom(tipo = "normal") {
  if (!audioLiberado) return;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.value = tipo === "critico" ? 880 : 520;

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn("Som bloqueado pelo navegador", e);
  }
}

function filaAbrirModal() {
  audioLiberado = true;
  document.getElementById("modalFila")?.classList.add("ativo");
}

function filaFecharModal() {
  document.getElementById("modalFila")?.classList.remove("ativo");
}

function filaAdicionar() {
  audioLiberado = true;

  const cliente = document.getElementById("filaCliente")?.value.trim();
  const telefone = document.getElementById("filaTelefone")?.value.trim();
  const tipo = document.getElementById("filaTipo")?.value;
  const obs = document.getElementById("filaObs")?.value.trim();

  if (!cliente) {
    alert("Informe o nome do contato.");
    return;
  }

  const agora = Date.now();

  const atendimento = {
    id: agora,
    cliente,
    telefone,
    tipo,
    obs,
    inicio: agora,
    ultimoRetorno: agora,
    proximoAlerta: agora + 2 * 60 * 1000,
    alertas: 0,
    historico: [
      {
        hora: new Date().toLocaleString("pt-BR"),
        texto: "Atendimento iniciado."
      }
    ]
  };

  filaAtendimentos.unshift(atendimento);
  filaSelecionadaId = atendimento.id;

  document.getElementById("filaCliente").value = "";
  document.getElementById("filaTelefone").value = "";
  document.getElementById("filaObs").value = "";

  filaFecharModal();
  filaSalvar();
  filaRender();
  filaRenderDetalhes();
}

function filaSelecionar(id) {
  filaSelecionadaId = id;
  filaRender();
  filaRenderDetalhes();
}

function filaMarcarRetorno(id) {
  audioLiberado = true;

  const item = filaAtendimentos.find(a => a.id === id);
  if (!item) return;

  const agora = Date.now();

  item.ultimoRetorno = agora;
  item.proximoAlerta = agora + 2 * 60 * 1000;
  item.alertas = 0;

  item.historico.unshift({
    hora: new Date().toLocaleString("pt-BR"),
    texto: "Atendente informou que voltou a falar com o cliente."
  });

  filaSalvar();
  filaRender();
  filaRenderDetalhes();
}

function filaAdicionarHistorico(id) {
  const item = filaAtendimentos.find(a => a.id === id);
  const campo = document.getElementById("filaNovaAcao");

  if (!item || !campo) return;

  const texto = campo.value.trim();

  if (!texto) {
    alert("Digite o que foi feito.");
    return;
  }

  item.historico.unshift({
    hora: new Date().toLocaleString("pt-BR"),
    texto
  });

  campo.value = "";

  filaSalvar();
  filaRenderDetalhes();
}

function filaFinalizar(id) {
  const item = filaAtendimentos.find(a => a.id === id);
  if (!item) return;

  const fim = Date.now();
  const duracao = fim - item.inicio;

  item.finalizadoEm = fim;
  item.duracao = duracao;

  filaFinalizados.unshift(item);
  filaFinalizados = filaFinalizados.slice(0, 200);

  filaAtendimentos = filaAtendimentos.filter(a => a.id !== id);

  if (filaSelecionadaId === id) {
    filaSelecionadaId = null;
  }

  filaSalvar();
  filaSalvarFinalizados();
  filaRender();
  filaRenderDetalhes();

  alert(`Atendimento finalizado.\nTempo total: ${filaFormatarTempo(duracao)}`);
}

function filaMediaAtendimento() {
  if (!filaFinalizados.length) return "00:00";

  const soma = filaFinalizados.reduce((acc, item) => acc + (item.duracao || 0), 0);
  const media = soma / filaFinalizados.length;

  return filaFormatarTempo(media);
}

function filaStatus(item) {
  const agora = Date.now();
  const semRetorno = agora - item.ultimoRetorno;

  if (semRetorno >= 6 * 60 * 1000) {
    return {
      card: "critico",
      tempo: "vermelho",
      texto: "Crítico"
    };
  }

  if (semRetorno >= 2 * 60 * 1000) {
    return {
      card: "alerta",
      tempo: "laranja",
      texto: "Atenção"
    };
  }

  return {
    card: "",
    tempo: "verde",
    texto: "Em dia"
  };
}

function filaRender() {
  const container = document.getElementById("filaContainer");
  if (!container) return;

  if (!filaAtendimentos.length) {
    container.innerHTML = `
      <p>Nenhum atendimento em andamento.</p>
      <p><strong>Tempo médio finalizado:</strong> ${filaMediaAtendimento()}</p>
    `;
    return;
  }

  container.innerHTML = `
    <p><strong>Ativos:</strong> ${filaAtendimentos.length}</p>
    <p><strong>Tempo médio finalizado:</strong> ${filaMediaAtendimento()}</p>
    ${filaAtendimentos.map(item => {
      const status = filaStatus(item);
      const tempoTotal = Date.now() - item.inicio;
      const selecionado = item.id === filaSelecionadaId ? "selecionado" : "";

      return `
        <div class="fila-card ${status.card} ${selecionado}" onclick="filaSelecionar(${item.id})">
          <h3>${item.cliente}</h3>
          <small>${item.tipo}</small><br>
          <small>${item.telefone || "Sem telefone"}</small>

          <div class="fila-tempo ${status.tempo}">
            ${filaFormatarTempo(tempoTotal)}
          </div>

          <small>Status: ${status.texto}</small>
        </div>
      `;
    }).join("")}
  `;
}

function filaRenderDetalhes() {
  const detalhes = document.getElementById("filaDetalhes");
  if (!detalhes) return;

  const item = filaAtendimentos.find(a => a.id === filaSelecionadaId);

  if (!item) {
    detalhes.innerHTML = `
      <div class="fila-vazio">
        <h3>Selecione um atendimento</h3>
        <p>Clique em um atendimento à esquerda para visualizar detalhes.</p>
      </div>
    `;
    return;
  }

  const tempoTotal = Date.now() - item.inicio;
  const tempoSemRetorno = Date.now() - item.ultimoRetorno;
  const status = filaStatus(item);

  detalhes.innerHTML = `
    <h2>${item.cliente}</h2>

    <p><strong>Telefone:</strong> ${item.telefone || "-"}</p>
    <p><strong>Tipo:</strong> ${item.tipo}</p>
    <p><strong>Observação inicial:</strong> ${item.obs || "-"}</p>

    <hr>

    <h3 class="fila-tempo ${status.tempo}">
      Tempo total: ${filaFormatarTempo(tempoTotal)}
    </h3>

    <p>
      Tempo desde último retorno:
      <strong>${filaFormatarTempo(tempoSemRetorno)}</strong>
    </p>

    <p>
      Próximo alerta:
      <strong>${filaFormatarTempo(item.proximoAlerta - Date.now())}</strong>
    </p>

    <div class="actions">
      <button class="success" onclick="filaMarcarRetorno(${item.id})">
        Já falei com o cliente
      </button>

      <button class="danger" onclick="filaFinalizar(${item.id})">
        Finalizar atendimento
      </button>
    </div>

    <hr>

    <label>Adicionar o que foi feito
      <textarea id="filaNovaAcao" placeholder="Ex: realizado teste de ping, cliente reiniciou roteador, aguardando retorno..."></textarea>
    </label>

    <button class="primary" onclick="filaAdicionarHistorico(${item.id})">
      Adicionar anotação
    </button>

    <h3>Histórico</h3>

    <div class="mini-list">
      ${
        item.historico && item.historico.length
          ? item.historico.map(h => `
              <div class="mini-item">
                <strong>${h.hora}</strong><br>
                ${h.texto}
              </div>
            `).join("")
          : "<p>Nenhuma anotação.</p>"
      }
    </div>
  `;
}

function filaVerificarAlertas() {
  const agora = Date.now();
  let alterou = false;

  filaAtendimentos.forEach(item => {
    if (agora >= item.proximoAlerta) {
      item.alertas = (item.alertas || 0) + 1;

      item.historico.unshift({
        hora: new Date().toLocaleString("pt-BR"),
        texto: `Alerta automático de retorno disparado (${item.alertas}º aviso).`
      });

      filaTocarSom(item.alertas >= 3 ? "critico" : "normal");

      item.proximoAlerta = agora + 2 * 60 * 1000;
      alterou = true;
    }
  });

  if (alterou) {
    filaSalvar();
  }
}

function filaInit() {
  document.getElementById("abrirModalFila")?.addEventListener("click", filaAbrirModal);
  document.getElementById("fecharModalFila")?.addEventListener("click", filaFecharModal);
  document.getElementById("adicionarFila")?.addEventListener("click", filaAdicionar);

  document.getElementById("modalFila")?.addEventListener("click", (e) => {
    if (e.target.id === "modalFila") {
      filaFecharModal();
    }
  });

  window.filaSelecionar = filaSelecionar;
  window.filaMarcarRetorno = filaMarcarRetorno;
  window.filaFinalizar = filaFinalizar;
  window.filaAdicionarHistorico = filaAdicionarHistorico;

  filaRender();
  filaRenderDetalhes();

  setInterval(() => {
    filaVerificarAlertas();
    filaRender();
    filaRenderDetalhes();
  }, 1000);
}

document.addEventListener("DOMContentLoaded", filaInit);
