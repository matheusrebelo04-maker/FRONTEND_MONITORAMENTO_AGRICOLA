import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

interface Ocorrencia {
  id: number;
  tipo: string;
  descricao: string;
  latitude?: number;
  longitude?: number;
  data?: string;
  endereco?: string;
}

interface TelemetriaESP32 {
  timestamp: string;
  device_id: string;
  equipamento: string;
  local: string;
  operacao: string;

  temperatura: number | null;
  umidade: number | null;

  accel_x: number | null;
  accel_y: number | null;
  accel_z: number | null;

  inclinacao: number | null;

  obstaculo: boolean;

  nivel_risco: string | null;
  score_risco: number | null;
  tipo_evento: string | null;

  latitude?: number | null;
  longitude?: number | null;
}

interface RiskIndicatorProps {
  ocorrencias: Ocorrencia[];
  onSessaoExpirada?: () => void;
}

function RiskIndicator({
  ocorrencias,
  onSessaoExpirada,
}: RiskIndicatorProps) {
  const [telemetria, setTelemetria] =
    useState<TelemetriaESP32 | null>(null);

  /*
   * =====================================================
   * TELEMETRIA EM TEMPO REAL
   * =====================================================
   */

  useEffect(() => {
    const token =
      localStorage.getItem("sompo_token");

    if (!token) {
      return;
    }

    let ativo = true;

    const buscarTelemetria = async () => {
      try {
        const resposta = await fetch(
          `${API_URL}/api/telemetria?tempo=${Date.now()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (resposta.status === 401) {
          console.warn(
            "Sessão expirada ao consultar telemetria."
          );

          if (ativo) {
            setTelemetria(null);
          }

          onSessaoExpirada?.();
          return;
        }

        if (!resposta.ok) {
          throw new Error(
            `Erro HTTP ${resposta.status}`
          );
        }

        const dados: TelemetriaESP32[] =
          await resposta.json();

        if (
          !Array.isArray(dados) ||
          dados.length === 0
        ) {
          if (ativo) {
            setTelemetria(null);
          }

          return;
        }

        /*
         * =================================================
         * PEGAR O REGISTRO MAIS RECENTE
         * =================================================
         */

        const ultimo = dados.reduce(
          (
            maisRecente,
            atual
          ) => {
            if (!maisRecente) {
              return atual;
            }

            const dataAtual =
              new Date(
                atual.timestamp
              ).getTime();

            const dataMaisRecente =
              new Date(
                maisRecente.timestamp
              ).getTime();

            return dataAtual >
              dataMaisRecente
              ? atual
              : maisRecente;
          },
          dados[0]
        );

        if (ativo) {
          setTelemetria(ultimo);
        }

      } catch (erro) {
        console.error(
          "Erro ao atualizar indicador de risco:",
          erro
        );
      }
    };

    buscarTelemetria();

    const intervalo = setInterval(
      buscarTelemetria,
      1000
    );

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [onSessaoExpirada]);

  /*
   * =====================================================
   * VALORES DOS SENSORES
   * =====================================================
   */

  const temperatura = telemetria
    ? Number(telemetria.temperatura)
    : 0;

  const umidade = telemetria
    ? Number(telemetria.umidade)
    : 0;

  /*
   * =====================================================
   * SCORE DE RISCO
   * =====================================================
   *
   * IMPORTANTE:
   *
   * O frontend NÃO calcula mais o risco.
   *
   * O valor exibido é exatamente o score_risco
   * enviado pelo backend.
   *
   * ESP32
   *   ↓
   * Flask / app.py
   *   ↓
   * Machine Learning / KNN
   *   ↓
   * score_risco 0 - 100
   *   ↓
   * React
   */

  let score =
    telemetria?.score_risco != null
      ? Number(
          telemetria.score_risco
        )
      : 0;

  if (!Number.isFinite(score)) {
    score = 0;
  }

  score = Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );

  /*
   * =====================================================
   * NÍVEL DE RISCO
   * =====================================================
   *
   * O nível enviado pelo backend é prioritário.
   *
   * CRITICO também é tratado corretamente.
   */

  const obterNivelRisco = () => {
    if (!telemetria) {
      return "Aguardando";
    }

    if (telemetria.nivel_risco) {
      const nivel =
        telemetria.nivel_risco
          .toUpperCase()
          .trim();

      if (nivel === "BAIXO") {
        return "Baixo";
      }

      if (
        nivel === "MEDIO" ||
        nivel === "MÉDIO"
      ) {
        return "Médio";
      }

      if (nivel === "ALTO") {
        return "Alto";
      }

      if (
        nivel === "CRITICO" ||
        nivel === "CRÍTICO"
      ) {
        return "Crítico";
      }
    }

    /*
     * =================================================
     * FALLBACK
     * =================================================
     *
     * Utiliza os mesmos limites definidos no backend.
     */

    if (score < 40) {
      return "Baixo";
    }

    if (score < 70) {
      return "Médio";
    }

    if (score < 90) {
      return "Alto";
    }

    return "Crítico";
  };

  const nivelRisco =
    obterNivelRisco();

  /*
   * =====================================================
   * COR DO RISCO
   * =====================================================
   */

  const obterCorRisco = () => {
    if (nivelRisco === "Baixo") {
      return "#16a34a";
    }

    if (nivelRisco === "Médio") {
      return "#eab308";
    }

    if (nivelRisco === "Alto") {
      return "#dc2626";
    }

    if (nivelRisco === "Crítico") {
      return "#000000";
    }

    return "#6b7280";
  };

  const corRisco =
    obterCorRisco();

  /*
   * =====================================================
   * PERCENTUAL DO CÍRCULO
   * =====================================================
   */

  const grausScore =
    score * 3.6;

  /*
   * =====================================================
   * FUNDO DO CÍRCULO
   * =====================================================
   */

  const fundoCirculo =
    `radial-gradient(circle at center, #ffffff 0%, #ffffff 54%, transparent 55%), ` +
    `conic-gradient(${corRisco} 0deg, ${corRisco} ${grausScore}deg, #edf0f2 ${grausScore}deg, #edf0f2 360deg)`;

  /*
   * =====================================================
   * STATUS DA TEMPERATURA
   * =====================================================
   */

  const temperaturaStatus =
    temperatura >= 35
      ? "Atenção"
      : "Normal";

  /*
   * =====================================================
   * STATUS DA UMIDADE
   * =====================================================
   */

  const umidadeStatus =
    umidade < 30 ||
    umidade > 80
      ? "Atenção"
      : "Normal";

  /*
   * =====================================================
   * OBSTÁCULO
   * =====================================================
   */

  const existeOcorrencia =
    ocorrencias.length > 0;

  const obstaculoDetectado =
    telemetria?.obstaculo === true ||
    existeOcorrencia;

  const obstaculoTexto =
    obstaculoDetectado
      ? "Identificado"
      : "Nenhum identificado";

  /*
   * =====================================================
   * EVENTO
   * =====================================================
   */

  const evento =
    telemetria?.tipo_evento ||
    "AGUARDANDO_TELEMETRIA";

  /*
   * =====================================================
   * DESCRIÇÃO DO RISCO
   * =====================================================
   */

  const obterDescricaoRisco = () => {
    if (!telemetria) {
      return "Aguardando dados do equipamento.";
    }

    if (nivelRisco === "Crítico") {
      return "Foram identificadas condições críticas que exigem intervenção imediata.";
    }

    if (nivelRisco === "Alto") {
      return "Existem condições de alto risco que exigem atenção imediata no monitoramento.";
    }

    if (nivelRisco === "Médio") {
      return "Existem condições que exigem atenção no monitoramento dos equipamentos.";
    }

    if (nivelRisco === "Baixo") {
      return "As condições monitoradas estão dentro dos parâmetros de operação.";
    }

    return "Dados de risco recebidos do equipamento.";
  };

  /*
   * =====================================================
   * MENSAGEM OPERACIONAL
   * =====================================================
   */

  const obterMensagemOperacional = () => {
    if (!telemetria) {
      return "Aguardando dados do ESP32 para atualizar o monitoramento.";
    }

    if (nivelRisco === "Crítico") {
      return "Condição crítica detectada pela análise dos sensores. Recomenda-se intervenção imediata.";
    }

    if (nivelRisco === "Alto") {
      return "Condição de alto risco detectada. Recomenda-se atenção imediata ao equipamento.";
    }

    if (evento === "NORMAL") {
      return "Nenhum evento de risco foi identificado. O equipamento está operando normalmente.";
    }

    return `Evento detectado pelo sistema: ${evento}. Recomenda-se acompanhar o equipamento.`;
  };

  /*
   * =====================================================
   * CLASSES
   * =====================================================
   */

  const classeTemperatura =
    temperaturaStatus === "Atenção"
      ? "condition-warning"
      : "condition-normal";

  const classeUmidade =
    umidadeStatus === "Atenção"
      ? "condition-warning"
      : "condition-normal";

  const classeObstaculo =
    obstaculoDetectado
      ? "condition-warning"
      : "condition-normal";

  return (
    <div className="risk-indicator-professional">

      {/* =================================================
          NÍVEL ATUAL
      ================================================= */}

      <div className="risk-main">

        <div className="risk-title">

          <span className="risk-label">
            NÍVEL ATUAL
          </span>

          <span
            className="risk-status-dot"
            style={{
              backgroundColor: corRisco,
              boxShadow: `0 0 0 4px ${corRisco}20`,
              transition:
                "background-color 0.5s ease, box-shadow 0.5s ease",
            }}
          ></span>

          <span className="risk-status-text">
            {telemetria
              ? "Monitoramento ativo"
              : "Aguardando telemetria"}
          </span>

        </div>

        <div className="risk-score-area">

          <div
            className="risk-score-circle"
            style={{
              background: fundoCirculo,
              transition:
                "background 0.5s ease",
            }}
          >

            <div className="risk-score-number">
              {score}
            </div>

            <div className="risk-score-text">
              RISCO
            </div>

          </div>

          <div className="risk-information">

            <span className="risk-information-label">
              Classificação da área
            </span>

            <strong
              className="risk-information-title"
              style={{
                color: corRisco,
                transition:
                  "color 0.5s ease",
              }}
            >
              {nivelRisco}
            </strong>

            <p>
              {obterDescricaoRisco()}
            </p>

          </div>

        </div>

      </div>

      {/* =================================================
          CONDIÇÕES
      ================================================= */}

      <div className="risk-conditions">

        {/* TEMPERATURA */}

        <div className="condition-item">

          <div
            className={`condition-icon ${classeTemperatura}`}
          >
            🌡️
          </div>

          <div className="condition-content">

            <span>
              Temperatura
            </span>

            <strong>
              {telemetria
                ? `${temperatura.toFixed(1)} °C`
                : "Aguardando"}
            </strong>

          </div>

          <span
            className={`condition-status ${
              temperaturaStatus === "Atenção"
                ? "warning"
                : "normal"
            }`}
          >
            {temperaturaStatus}
          </span>

        </div>

        {/* UMIDADE */}

        <div className="condition-item">

          <div
            className={`condition-icon ${classeUmidade}`}
          >
            💧
          </div>

          <div className="condition-content">

            <span>
              Umidade
            </span>

            <strong>
              {telemetria
                ? `${umidade.toFixed(1)}%`
                : "Aguardando"}
            </strong>

          </div>

          <span
            className={`condition-status ${
              umidadeStatus === "Atenção"
                ? "warning"
                : "normal"
            }`}
          >
            {umidadeStatus}
          </span>

        </div>

        {/* OBSTÁCULOS */}

        <div className="condition-item">

          <div
            className={`condition-icon ${classeObstaculo}`}
          >
            🚧
          </div>

          <div className="condition-content">

            <span>
              Obstáculos
            </span>

            <strong>
              {obstaculoTexto}
            </strong>

          </div>

          <span
            className={`condition-status ${
              obstaculoDetectado
                ? "warning"
                : "normal"
            }`}
          >
            {obstaculoDetectado
              ? "Atenção"
              : "Normal"}
          </span>

        </div>

      </div>

      {/* =================================================
          ATENÇÃO OPERACIONAL
      ================================================= */}

      <div className="risk-message">

        <span className="risk-message-icon">
          ⚠️
        </span>

        <div>

          <strong>
            Atenção operacional
          </strong>

          <p>
            {obterMensagemOperacional()}
          </p>

        </div>

      </div>

    </div>
  );
}

export default RiskIndicator;