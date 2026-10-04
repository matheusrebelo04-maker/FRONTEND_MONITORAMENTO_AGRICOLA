import { useEffect, useState } from "react";
import "./App.css";

import RiskIndicator from "./components/RiskIndicator";
import MapaOperacional from "./components/MapaOperacional";
import Ocorrencias from "./pages/Ocorrencias";

type Pagina = "dashboard" | "ocorrencias" | "relatorios";

interface Ocorrencia {
  id: number;
  tipo: string;
  descricao: string;
  latitude?: number;
  longitude?: number;
  data?: string;
}

interface Equipamento {
  id: string;
  nome: string;
  local: string;
  risco: "Baixo" | "Médio" | "Alto" | "Crítico";
  temperatura: number;
  umidade: number;
  inclinacao: number;
  velocidade: number;
  alerta: string;
  score?: number;
  accel_x?: number;
  accel_y?: number;
  accel_z?: number;
}

interface TelemetriaESP32 {
  device_id: string;
  equipamento: string;
  local: string;
  operacao: string;
  temperatura: number;
  umidade: number;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  inclinacao: number;
  obstaculo: boolean;
  nivel_risco: string;
  score_risco: number;
  tipo_evento: string;
}

function App() {
  const [pagina, setPagina] = useState<Pagina>("dashboard");

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);

  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(
    new Date().toLocaleTimeString("pt-BR")
  );

  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([
    {
      id: "ESP001",
      nome: "Trator",
      local: "Fazenda Santa Clara",
      risco: "Alto",
      temperatura: 37,
      umidade: 25,
      inclinacao: 10,
      velocidade: 50,
      alerta: "Umidade do solo abaixo do recomendado.",
    },
    {
      id: "ESP002",
      nome: "Plantadeira",
      local: "Setor Norte",
      risco: "Baixo",
      temperatura: 28,
      umidade: 65,
      inclinacao: 5,
      velocidade: 40,
      alerta: "Operação normal.",
    },
    {
      id: "ESP003",
      nome: "Colheitadeira",
      local: "Talhão 5",
      risco: "Alto",
      temperatura: 35,
      umidade: 30,
      inclinacao: 12,
      velocidade: 48,
      alerta: "Inclinação acima do parâmetro operacional.",
    },
  ]);

  useEffect(() => {
    const buscarTelemetria = async () => {
      try {
        const resposta = await fetch("http://localhost:8000/api/telemetria");

        if (!resposta.ok) {
          throw new Error("Erro ao buscar telemetria");
        }

        const dados: TelemetriaESP32[] = await resposta.json();

        if (!Array.isArray(dados) || dados.length === 0) {
          return;
        }

        const ultimo = dados[dados.length - 1];

        const riscoFormatado: Equipamento["risco"] =
          ultimo.nivel_risco === "CRITICO"
            ? "Crítico"
            : ultimo.nivel_risco === "ALTO"
            ? "Alto"
            : ultimo.nivel_risco === "MEDIO" ||
              ultimo.nivel_risco === "MÉDIO"
            ? "Médio"
            : "Baixo";

        const alerta =
          ultimo.tipo_evento === "NORMAL"
            ? "Operação normal."
            : `Evento detectado: ${ultimo.tipo_evento}.`;

        setEquipamentos((anteriores) =>
          anteriores.map((equipamento) =>
            equipamento.id === ultimo.device_id
              ? {
                  ...equipamento,
                  nome: ultimo.equipamento,
                  local: ultimo.local,
                  risco: riscoFormatado,
                  temperatura: Number(ultimo.temperatura),
                  umidade: Number(ultimo.umidade),
                  inclinacao: Number(ultimo.inclinacao),
                  alerta,
                  score: Number(ultimo.score_risco),
                  accel_x: Number(ultimo.accel_x),
                  accel_y: Number(ultimo.accel_y),
                  accel_z: Number(ultimo.accel_z),
                }
              : equipamento
          )
        );

        setUltimaAtualizacao(new Date().toLocaleTimeString("pt-BR"));
      } catch (erro) {
        console.error("Erro ao buscar telemetria do ESP32:", erro);
      }
    };

    buscarTelemetria();

    const intervalo = setInterval(buscarTelemetria, 2000);

    return () => clearInterval(intervalo);
  }, []);

  const adicionarOcorrencia = (ocorrencia: Ocorrencia) => {
    setOcorrencias((anteriores) => [
      ...anteriores,
      ocorrencia,
    ]);
  };

  const equipamentosAltoRisco = equipamentos.filter(
    (equipamento) => equipamento.risco === "Alto"
  ).length;

  const equipamentosMedioRisco = equipamentos.filter(
    (equipamento) => equipamento.risco === "Médio"
  ).length;

  const equipamentosBaixoRisco = equipamentos.filter(
    (equipamento) => equipamento.risco === "Baixo"
  ).length;

  const equipamentosCriticos = equipamentos.filter(
    (equipamento) => equipamento.risco === "Crítico"
  ).length;

  const gerarRelatorio = () => {
    const dataAtual = new Date().toLocaleString("pt-BR");

    const linhasEquipamentos = equipamentos
      .map(
        (equipamento) => `
          <tr>
            <td>${equipamento.id}</td>
            <td>${equipamento.nome}</td>
            <td>${equipamento.local}</td>
            <td>${equipamento.risco}</td>
            <td>${equipamento.temperatura} °C</td>
            <td>${equipamento.umidade}%</td>
            <td>${equipamento.inclinacao}°</td>
            <td>${equipamento.velocidade} km/h</td>
            <td>${equipamento.alerta}</td>
          </tr>
        `
      )
      .join("");

    const linhasOcorrencias =
      ocorrencias.length > 0
        ? ocorrencias
            .map(
              (ocorrencia) => `
                <tr>
                  <td>${ocorrencia.tipo}</td>
                  <td>${ocorrencia.descricao}</td>
                  <td>
                    ${
                      ocorrencia.latitude !== undefined
                        ? ocorrencia.latitude.toFixed(5)
                        : "-"
                    }
                  </td>
                  <td>
                    ${
                      ocorrencia.longitude !== undefined
                        ? ocorrencia.longitude.toFixed(5)
                        : "-"
                    }
                  </td>
                  <td>${ocorrencia.data || "-"}</td>
                </tr>
              `
            )
            .join("")
        : `
          <tr>
            <td colspan="5">Nenhuma ocorrência registrada.</td>
          </tr>
        `;

    const conteudo = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />

        <title>Relatório Geral - Sompo</title>

        <style>

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 35px;
            font-family: Arial, Helvetica, sans-serif;
            color: #20252b;
            background: #ffffff;
          }

          .topo {
            border-bottom: 4px solid #d7193f;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }

          .logo {
            color: #d7193f;
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 5px;
          }

          h1 {
            margin: 0;
            font-size: 26px;
          }

          h2 {
            margin-top: 30px;
            border-left: 5px solid #d7193f;
            padding-left: 10px;
          }

          .data {
            color: #666;
            font-size: 13px;
            margin-top: 8px;
          }

          .resumo {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin: 25px 0;
          }

          .card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            background: #fafafa;
          }

          .card strong {
            display: block;
            font-size: 28px;
            margin-top: 5px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 11px;
          }

          th {
            background: #d7193f;
            color: white;
            padding: 9px;
            text-align: left;
          }

          td {
            border: 1px solid #ddd;
            padding: 8px;
          }

          tr:nth-child(even) {
            background: #f8f8f8;
          }

          .rodape {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #777;
          }

          .botao-imprimir {
            background: #d7193f;
            color: white;
            border: 0;
            padding: 12px 22px;
            border-radius: 7px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 25px;
          }

          @media print {
            body {
              padding: 15px;
            }

            .botao-imprimir {
              display: none;
            }

            .resumo {
              grid-template-columns: repeat(4, 1fr);
            }

            table {
              page-break-inside: auto;
            }

            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }

        </style>
      </head>

      <body>

        <button
          class="botao-imprimir"
          onclick="window.print()"
        >
          🖨️ Imprimir / Salvar como PDF
        </button>

        <div class="topo">
          <div class="logo">Sompo</div>

          <h1>
            Relatório Geral de Monitoramento Agrícola
          </h1>

          <div class="data">
            Gerado em: ${dataAtual}
          </div>
        </div>

        <h2>Resumo operacional</h2>

        <div class="resumo">

          <div class="card">
            <span>Equipamentos monitorados</span>
            <strong>${equipamentos.length}</strong>
          </div>

          <div class="card">
            <span>Alto risco</span>
            <strong>${equipamentosAltoRisco}</strong>
          </div>

          <div class="card">
            <span>Risco médio</span>
            <strong>${equipamentosMedioRisco}</strong>
          </div>

          <div class="card">
            <span>Operação normal</span>
            <strong>${equipamentosBaixoRisco}</strong>
          </div>

        </div>

        <h2>Equipamentos monitorados</h2>

        <table>

          <thead>
            <tr>
              <th>ID</th>
              <th>Equipamento</th>
              <th>Local</th>
              <th>Risco</th>
              <th>Temperatura</th>
              <th>Umidade</th>
              <th>Inclinação</th>
              <th>Velocidade</th>
              <th>Alerta</th>
            </tr>
          </thead>

          <tbody>
            ${linhasEquipamentos}
          </tbody>

        </table>

        <h2>Ocorrências registradas</h2>

        <table>

          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Data</th>
            </tr>
          </thead>

          <tbody>
            ${linhasOcorrencias}
          </tbody>

        </table>

        <h2>Situação de risco</h2>

        <table>

          <thead>
            <tr>
              <th>Nível</th>
              <th>Quantidade</th>
            </tr>
          </thead>

          <tbody>

            <tr>
              <td>Baixo</td>
              <td>${equipamentosBaixoRisco}</td>
            </tr>

            <tr>
              <td>Médio</td>
              <td>${equipamentosMedioRisco}</td>
            </tr>

            <tr>
              <td>Alto</td>
              <td>${equipamentosAltoRisco}</td>
            </tr>

            <tr>
              <td>Crítico</td>
              <td>${equipamentosCriticos}</td>
            </tr>

          </tbody>

        </table>

        <div class="rodape">
          Sompo Seguros • Monitoramento Agrícola •
          Sistema de Gestão de Riscos
        </div>

      </body>
      </html>
    `;

    const janela = window.open("", "_blank");

    if (!janela) {
      alert(
        "Não foi possível abrir o relatório. Verifique se o navegador bloqueou o pop-up."
      );
      return;
    }

    janela.document.open();
    janela.document.write(conteudo);
    janela.document.close();

    janela.focus();
  };

  return (
    <div className="app">

      <header className="header">

        <div className="logo-area">

          <div className="logo-icon">
            S
          </div>

          <div>
            <h1>Sompo</h1>
            <span>
              Monitoramento Agrícola
            </span>
          </div>

        </div>

        <div className="status">

          <span className="status-dot"></span>

          Sistema operacional

        </div>

      </header>

      <nav className="menu">

        <button
          className={
            pagina === "dashboard"
              ? "menu-active"
              : ""
          }
          onClick={() =>
            setPagina("dashboard")
          }
        >
          📊 Dashboard
        </button>

        <button
          className={
            pagina === "ocorrencias"
              ? "menu-active"
              : ""
          }
          onClick={() =>
            setPagina("ocorrencias")
          }
        >
          ⚠️ Ocorrências
        </button>

        <button
          className={
            pagina === "relatorios"
              ? "menu-active"
              : ""
          }
          onClick={() =>
            setPagina("relatorios")
          }
        >
          📄 Relatórios
        </button>

      </nav>

      <main className="content">

        {pagina === "dashboard" && (
          <>

            <section className="welcome">

              <div>

                <h2>
                  Monitoramento Agrícola
                </h2>

                <p>
                  Acompanhe em tempo real as
                  condições dos equipamentos e
                  identifique situações de risco.
                </p>

              </div>

              <div className="update">

                Última atualização

                <strong>
                  {ultimaAtualizacao}
                </strong>

              </div>

            </section>

            <section className="cards">

              <div className="card">

                <span className="card-icon">
                  🚜
                </span>

                <div>
                  <p>
                    Equipamentos monitorados
                  </p>

                  <strong>
                    {equipamentos.length}
                  </strong>
                </div>

              </div>

              <div className="card card-danger">

                <span className="card-icon">
                  🔴
                </span>

                <div>
                  <p>
                    Alto risco
                  </p>

                  <strong>
                    {equipamentosAltoRisco}
                  </strong>
                </div>

              </div>

              <div className="card card-warning">

                <span className="card-icon">
                  🟡
                </span>

                <div>
                  <p>
                    Risco médio
                  </p>

                  <strong>
                    {equipamentosMedioRisco}
                  </strong>
                </div>

              </div>

              <div className="card card-success">

                <span className="card-icon">
                  🟢
                </span>

                <div>
                  <p>
                    Operação normal
                  </p>

                  <strong>
                    {equipamentosBaixoRisco}
                  </strong>
                </div>

              </div>

            </section>

            <section className="panel">

              <div className="panel-header">

                <div>

                  <h3>
                    Monitoramento dos ESP32
                  </h3>

                  <p>
                    Dados recebidos dos dispositivos
                    em campo
                  </p>

                </div>

              </div>

              <div className="equipment-grid">

                {equipamentos.map(
                  (equipamento) => (

                    <div
                      className="equipment-card"
                      key={equipamento.id}
                    >

                      <div className="equipment-header">

                        <div>

                          <strong>
                            {equipamento.id}
                          </strong>

                          <span>
                            {equipamento.nome}
                          </span>

                        </div>

                        <span
                          className={`risk-badge risk-${equipamento.risco
                            .toLowerCase()
                            .replace("é", "e")
                            .replace("í", "i")}`}
                        >
                          {equipamento.risco}
                        </span>

                      </div>

                      <p className="equipment-location">
                        📍 {equipamento.local}
                      </p>

                      <div className="sensor-grid">

                        <div className="sensor">
                          <span>🌡️</span>
                          <small>Temperatura</small>
                          <strong>
                            {equipamento.temperatura}°C
                          </strong>
                        </div>

                        <div className="sensor">
                          <span>💧</span>
                          <small>Umidade</small>
                          <strong>
                            {equipamento.umidade}%
                          </strong>
                        </div>

                        <div className="sensor">
                          <span>📐</span>
                          <small>Inclinação</small>
                          <strong>
                            {equipamento.inclinacao}°
                          </strong>
                        </div>

                        <div className="sensor">
                          <span>🚜</span>
                          <small>Velocidade</small>
                          <strong>
                            {equipamento.velocidade}
                            {" "}
                            km/h
                          </strong>
                        </div>

                      </div>

                      <div className="equipment-alert">

                        <span>⚠️</span>

                        <div>

                          <small>
                            Status
                          </small>

                          <p>
                            {equipamento.alerta}
                          </p>

                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            </section>

            <section className="dashboard-grid">

              <div className="panel">

                <div className="panel-header">

                  <div>

                    <h3>
                      Nível de risco
                    </h3>

                    <p>
                      Monitoramento atual dos
                      equipamentos
                    </p>

                  </div>

                </div>

                <RiskIndicator
                  ocorrencias={ocorrencias}
                />

              </div>

              <div className="panel">

                <div className="panel-header">

                  <div>

                    <h3>
                      Distribuição de risco
                    </h3>

                    <p>
                      Situação dos equipamentos
                    </p>

                  </div>

                </div>

                <div className="risk-list">

                  <div className="risk-row">

                    <span>
                      🟢 Baixo
                    </span>

                    <strong>
                      {equipamentosBaixoRisco}
                    </strong>

                  </div>

                  <div className="risk-row">

                    <span>
                      🟡 Médio
                    </span>

                    <strong>
                      {equipamentosMedioRisco}
                    </strong>

                  </div>

                  <div className="risk-row">

                    <span>
                      🔴 Alto
                    </span>

                    <strong>
                      {equipamentosAltoRisco}
                    </strong>

                  </div>

                  <div className="risk-row">

                    <span>
                      ⚫ Crítico
                    </span>

                    <strong>
                      {equipamentosCriticos}
                    </strong>

                  </div>

                </div>

              </div>

            </section>

            <section className="panel map-panel">

              <div className="panel-header">

                <div>

                  <h3>
                    Mapa operacional
                  </h3>

                  <p>
                    Visualização das ocorrências
                    no campo
                  </p>

                </div>

                <div className="map-actions">

                  <button
                    className="secondary-button"
                    onClick={() =>
                      alert(
                        "Solicitando localização atual..."
                      )
                    }
                  >
                    📍 Minha localização
                  </button>

                  <button
                    className="primary-button"
                    onClick={() =>
                      setPagina("ocorrencias")
                    }
                  >
                    + Registrar ocorrência
                  </button>

                </div>

              </div>

              <MapaOperacional />

            </section>

          </>
        )}

        {pagina === "ocorrencias" && (

          <Ocorrencias
            ocorrencias={ocorrencias}
            adicionarOcorrencia={
              adicionarOcorrencia
            }
          />

        )}

        {pagina === "relatorios" && (

          <section className="panel reports-page">

            <div className="panel-header">

              <div>

                <h2>
                  Relatórios
                </h2>

                <p>
                  Gere um relatório geral de
                  todos os monitoramentos.
                </p>

              </div>

            </div>

            <div className="report-box">

              <div className="report-icon">
                📄
              </div>

              <h3>
                Relatório geral de monitoramento
              </h3>

              <p>
                O relatório reúne informações
                dos equipamentos, níveis de
                risco, sensores e ocorrências
                registradas.
              </p>

              <button
                className="primary-button"
                onClick={gerarRelatorio}
              >
                📄 Gerar relatório
              </button>

            </div>

          </section>

        )}

      </main>

      <footer className="footer">

        <span>
          Sompo Seguros
        </span>

        <span>
          Monitoramento Agrícola •
          Sistema de Gestão de Riscos
        </span>

      </footer>

    </div>
  );
}

export default App;