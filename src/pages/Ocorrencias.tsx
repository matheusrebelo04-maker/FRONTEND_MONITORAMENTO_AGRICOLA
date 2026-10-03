import { useState } from "react";
import MapaOperacional from "../components/MapaOperacional";

interface Ocorrencia {
  id: number;
  tipo: string;
  descricao: string;
  latitude?: number;
  longitude?: number;
  data?: string;
  endereco?: string;
}

interface EquipamentoSelecionado {
  nome: string;
  device_id: string;
}

interface OcorrenciasProps {
  ocorrencias: Ocorrencia[];
  adicionarOcorrencia: (ocorrencia: Ocorrencia) => void;

  // Preparação para autenticação
  token?: string;

  // Equipamento/ESP32 atualmente selecionado
  equipamentoSelecionado?: EquipamentoSelecionado;
}

interface TelemetriaGPS {
  latitude?: number;
  longitude?: number;
  equipamento?: string;
  device_id?: string;
}

const API_URL = "http://localhost:8000";

const tiposOcorrencia = [
  {
    id: "obstaculo",
    nome: "Obstáculo",
    icone: "🚧",
    descricao: "Objeto ou obstáculo identificado no caminho.",
  },
  {
    id: "acidente",
    nome: "Acidente",
    icone: "🚨",
    descricao: "Acidente envolvendo equipamento ou operação.",
  },
  {
    id: "falha",
    nome: "Falha no equipamento",
    icone: "⚙️",
    descricao: "Problema ou falha em algum equipamento.",
  },
  {
    id: "risco",
    nome: "Área de risco",
    icone: "⚠️",
    descricao: "Área que apresenta condições de risco.",
  },
  {
    id: "clima",
    nome: "Problema climático",
    icone: "🌧️",
    descricao: "Chuva, vento forte ou outra condição climática.",
  },
  {
    id: "outro",
    nome: "Outro",
    icone: "📝",
    descricao: "Registrar outro tipo de ocorrência.",
  },
];

export default function Ocorrencias({
  ocorrencias,
  adicionarOcorrencia,
  token,
  equipamentoSelecionado,
}: OcorrenciasProps) {
  const [tipoSelecionado, setTipoSelecionado] =
    useState("");

  const [descricao, setDescricao] =
    useState("");

  const [latitude, setLatitude] =
    useState<number | undefined>(undefined);

  const [longitude, setLongitude] =
    useState<number | undefined>(undefined);

  const [endereco, setEndereco] =
    useState("");

  const [localizando, setLocalizando] =
    useState(false);

  const [buscandoEndereco, setBuscandoEndereco] =
    useState(false);

  const [mensagemLocalizacao, setMensagemLocalizacao] =
    useState(
      "Use o GPS do ESP32 ou informe manualmente o endereço."
    );

  const [enviando, setEnviando] =
    useState(false);

  // ============================================================
  // CABEÇALHOS DE AUTENTICAÇÃO
  // ============================================================

  const headersAutenticacao = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Usa primeiro o token atual salvo pelo login.
    // Caso não exista, utiliza o token recebido pelas props.
    const tokenAtual =
      localStorage.getItem("sompo_token") || token;

    if (tokenAtual) {
      headers.Authorization = `Bearer ${tokenAtual}`;
    }

    return headers;
  };

  // ============================================================
  // BUSCAR ENDEREÇO A PARTIR DO GPS
  // ============================================================

  const buscarEnderecoGPS = async (
    lat: number,
    lng: number
  ) => {
    setBuscandoEndereco(true);

    setMensagemLocalizacao(
      "GPS encontrado. Buscando endereço..."
    );

    try {
      const resposta = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );

      if (!resposta.ok) {
        throw new Error(
          "Erro ao buscar endereço."
        );
      }

      const resultado =
        await resposta.json();

      if (
        resultado &&
        resultado.display_name
      ) {
        setEndereco(
          resultado.display_name
        );

        setMensagemLocalizacao(
          `GPS encontrado: ${lat.toFixed(
            6
          )}, ${lng.toFixed(
            6
          )}`
        );
      } else {
        setEndereco(
          "Endereço não localizado"
        );

        setMensagemLocalizacao(
          `GPS encontrado: ${lat.toFixed(
            6
          )}, ${lng.toFixed(
            6
          )}`
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao buscar endereço:",
        erro
      );

      setEndereco(
        "Endereço não localizado automaticamente"
      );

      setMensagemLocalizacao(
        `GPS encontrado: ${lat.toFixed(
          6
        )}, ${lng.toFixed(
          6
        )}`
      );
    } finally {
      setBuscandoEndereco(false);
    }
  };

  // ============================================================
  // LOCALIZAÇÃO PELO GPS DO ESP32
  // ============================================================

  const obterLocalizacao = async () => {
    setLocalizando(true);

    setMensagemLocalizacao(
      "Obtendo localização do GPS do ESP32..."
    );

    try {
      const resposta = await fetch(
        `${API_URL}/api/telemetria?tempo=${Date.now()}`,
        {
          method: "GET",
          headers: headersAutenticacao(),
          cache: "no-store",
        }
      );

      if (!resposta.ok) {
        if (resposta.status === 401) {
          throw new Error(
            "Sessão expirada. Faça login novamente."
          );
        }

        throw new Error(
          "Não foi possível consultar o backend."
        );
      }

      const dados: TelemetriaGPS[] =
        await resposta.json();

      if (
        !dados ||
        dados.length === 0
      ) {
        setMensagemLocalizacao(
          "Nenhuma telemetria do ESP32 foi encontrada."
        );

        return;
      }

      // Se houver um equipamento selecionado,
      // tentamos utilizar o GPS dele.
      let leiturasFiltradas = dados;

      if (
        equipamentoSelecionado?.device_id
      ) {
        const leiturasDoEquipamento =
          dados.filter(
            (item) =>
              item.device_id ===
              equipamentoSelecionado.device_id
          );

        if (
          leiturasDoEquipamento.length > 0
        ) {
          leiturasFiltradas =
            leiturasDoEquipamento;
        }
      }

      const ultimaLeitura =
        leiturasFiltradas[
          leiturasFiltradas.length - 1
        ];

      const lat =
        Number(
          ultimaLeitura.latitude
        );

      const lng =
        Number(
          ultimaLeitura.longitude
        );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat === 0 ||
        lng === 0
      ) {
        setMensagemLocalizacao(
          "O GPS do ESP32 ainda não possui uma posição válida. Aguarde o GPS encontrar os satélites."
        );

        setLatitude(undefined);
        setLongitude(undefined);

        return;
      }

      setLatitude(lat);
      setLongitude(lng);

      await buscarEnderecoGPS(
        lat,
        lng
      );
    } catch (erro) {
      console.error(
        "Erro ao obter GPS do ESP32:",
        erro
      );

      setMensagemLocalizacao(
        erro instanceof Error &&
          erro.message.includes("Sessão")
          ? erro.message
          : "Não foi possível obter a localização do ESP32. Verifique se o backend está funcionando."
      );
    } finally {
      setLocalizando(false);
    }
  };

  // ============================================================
  // BUSCAR ENDEREÇO MANUALMENTE
  // ============================================================

  const buscarEndereco = async () => {
    if (!endereco.trim()) {
      alert(
        "Digite um endereço para localizar a ocorrência."
      );

      return;
    }

    setBuscandoEndereco(true);

    setMensagemLocalizacao(
      "Localizando o endereço informado..."
    );

    try {
      const enderecoFormatado =
        encodeURIComponent(
          endereco.trim()
        );

      const resposta =
        await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${enderecoFormatado}`
        );

      if (!resposta.ok) {
        throw new Error(
          "Erro ao consultar o endereço."
        );
      }

      const resultados =
        await resposta.json();

      if (
        !resultados ||
        resultados.length === 0
      ) {
        setMensagemLocalizacao(
          "Endereço não encontrado. Tente informar um endereço mais completo."
        );

        setLatitude(undefined);
        setLongitude(undefined);

        return;
      }

      const resultado =
        resultados[0];

      const lat =
        Number(resultado.lat);

      const lng =
        Number(resultado.lon);

      setLatitude(lat);
      setLongitude(lng);

      setEndereco(
        resultado.display_name
      );

      setMensagemLocalizacao(
        `Endereço localizado: ${resultado.display_name}`
      );
    } catch (erro) {
      console.error(
        erro
      );

      setMensagemLocalizacao(
        "Não foi possível localizar esse endereço. Tente novamente."
      );
    } finally {
      setBuscandoEndereco(false);
    }
  };

  // ============================================================
  // REGISTRAR OCORRÊNCIA
  // ============================================================

  const registrarOcorrencia =
    async () => {
      if (!tipoSelecionado) {
        alert(
          "Selecione o tipo de ocorrência."
        );

        return;
      }

      if (!descricao.trim()) {
        alert(
          "Descreva o problema encontrado."
        );

        return;
      }

      if (
        latitude === undefined ||
        longitude === undefined
      ) {
        alert(
          "Obtenha a localização pelo GPS do ESP32 ou informe um endereço."
        );

        return;
      }

      const tipoEncontrado =
        tiposOcorrencia.find(
          (tipo) =>
            tipo.id ===
            tipoSelecionado
        );

      setEnviando(true);

      try {
        const nomeEquipamento =
          equipamentoSelecionado?.nome ||
          "Trator";

        const deviceId =
          equipamentoSelecionado?.device_id ||
          "ESP001";

        const resposta =
          await fetch(
            `${API_URL}/api/ocorrencias`,
            {
              method: "POST",

              headers:
                headersAutenticacao(),

              body: JSON.stringify({
                tipo:
                  tipoEncontrado?.nome ||
                  "Ocorrência",

                descricao:
                  descricao.trim(),

                latitude,

                longitude,

                endereco:
                  endereco.trim() ||
                  "Endereço não localizado",

                equipamento:
                  nomeEquipamento,

                device_id:
                  deviceId,
              }),
            }
          );

        if (!resposta.ok) {
          const erro =
            await resposta.json().catch(
              () => ({})
            );

          throw new Error(
            erro.erro ||
            "Erro ao registrar ocorrência."
          );
        }

        const ocorrenciaSalva =
          await resposta.json();

        const novaOcorrencia:
          Ocorrencia = {
            id:
              ocorrenciaSalva.id,

            tipo:
              ocorrenciaSalva.tipo,

            descricao:
              ocorrenciaSalva.descricao,

            latitude:
              ocorrenciaSalva.latitude,

            longitude:
              ocorrenciaSalva.longitude,

            data:
              ocorrenciaSalva.data,

            endereco:
              ocorrenciaSalva.endereco,
          };

        adicionarOcorrencia(
          novaOcorrencia
        );

        setTipoSelecionado("");

        setDescricao("");

        setLatitude(undefined);

        setLongitude(undefined);

        setEndereco("");

        setMensagemLocalizacao(
          "Ocorrência registrada. Escolha uma nova localização para registrar outra."
        );

        alert(
          "Ocorrência registrada com sucesso!"
        );
      } catch (erro) {
        console.error(
          "Erro ao registrar ocorrência:",
          erro
        );

        const mensagem =
          erro instanceof Error
            ? erro.message
            : "";

        alert(
          mensagem ||
            "Não foi possível registrar a ocorrência. Verifique se o backend está funcionando."
        );
      } finally {
        setEnviando(false);
      }
    };

  return (
    <div className="ocorrencias-modern">

      <style>{`

        .ocorrencias-modern {
          width: 100%;
          color: #20252b;
          font-family: Arial, Helvetica, sans-serif;
        }

        .ocorrencias-modern *,
        .ocorrencias-modern *::before,
        .ocorrencias-modern *::after {
          box-sizing: border-box;
        }

        .oc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .oc-title-area h2 {
          margin: 0 0 7px;
          font-size: 27px;
          line-height: 1.2;
          color: #171c22;
          font-weight: 800;
        }

        .oc-title-area p {
          margin: 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
        }

        .oc-counter {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          background: #ffffff;
          border: 1px solid #e5e8ec;
          border-radius: 10px;
          color: #596574;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 3px 12px rgba(20,30,40,.05);
          white-space: nowrap;
        }

        .oc-counter-icon {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff0f2;
          border-radius: 7px;
          color: #d7193f;
        }

        .oc-card,
        .oc-location-card,
        .oc-map-card,
        .oc-history {
          background: #ffffff;
          border: 1px solid #e3e7eb;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 6px 22px rgba(20,30,40,.06);
          margin-bottom: 18px;
        }

        .oc-card-header,
        .oc-location-header {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 20px 22px;
          border-bottom: 1px solid #edf0f3;
        }

        .oc-header-icon,
        .oc-location-icon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #fff0f2;
          font-size: 20px;
        }

        .oc-card-header h3,
        .oc-location-header h3,
        .oc-map-header h3,
        .oc-history-header h3 {
          margin: 0 0 3px;
          color: #20252b;
          font-size: 16px;
          font-weight: 800;
        }

        .oc-card-header p,
        .oc-location-header p,
        .oc-map-header p,
        .oc-history-header p {
          margin: 0;
          color: #7a8491;
          font-size: 11px;
        }

        .oc-types {
          padding: 20px 22px 12px;
        }

        .oc-section-label {
          display: block;
          margin-bottom: 12px;
          color: #374151;
          font-size: 12px;
          font-weight: 800;
        }

        .oc-type-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .oc-type-button {
          position: relative;
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          min-height: 66px;
          padding: 11px 13px;
          text-align: left;
          background: #ffffff;
          color: #303943;
          border: 1px solid #e1e5ea;
          border-radius: 11px;
          cursor: pointer;
          transition: all .18s ease;
          font-family: inherit;
        }

        .oc-type-button:hover {
          border-color: #d7193f;
          background: #fff9fa;
          transform: translateY(-1px);
          box-shadow: 0 5px 14px rgba(215,25,63,.08);
        }

        .oc-type-button.selected {
          border-color: #d7193f;
          background: #fff3f5;
          box-shadow: 0 0 0 2px rgba(215,25,63,.08);
        }

        .oc-type-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f7f8fa;
          border-radius: 9px;
          font-size: 18px;
        }

        .oc-type-info {
          min-width: 0;
        }

        .oc-type-name {
          display: block;
          margin-bottom: 3px;
          color: #242b34;
          font-size: 11px;
          font-weight: 800;
        }

        .oc-type-description {
          display: block;
          color: #7a8491;
          font-size: 9px;
          line-height: 1.35;
        }

        .oc-check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 19px;
          height: 19px;
          display: none;
          align-items: center;
          justify-content: center;
          background: #d7193f;
          color: #ffffff;
          border-radius: 50%;
          font-size: 10px;
          font-weight: 800;
        }

        .oc-type-button.selected .oc-check {
          display: flex;
        }

        .oc-description {
          padding: 8px 22px 20px;
        }

        .oc-description textarea {
          display: block;
          width: 100%;
          min-height: 105px;
          resize: vertical;
          padding: 13px 14px;
          background: #fafbfc;
          color: #20252b;
          border: 1px solid #e0e4e8;
          border-radius: 10px;
          outline: none;
          font-family: inherit;
          font-size: 12px;
          line-height: 1.5;
        }

        .oc-description textarea:focus,
        .oc-address-input:focus {
          background: #ffffff;
          border-color: #d7193f;
          box-shadow: 0 0 0 3px rgba(215,25,63,.09);
        }

        .oc-location-content {
          padding: 18px 22px 22px;
        }

        .oc-location-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 15px;
        }

        .oc-location-option {
          padding: 15px;
          background: #ffffff;
          border: 1px solid #e0e4e8;
          border-radius: 12px;
          cursor: pointer;
          transition: .18s ease;
        }

        .oc-location-option:hover {
          border-color: #d7193f;
          background: #fff9fa;
        }

        .oc-location-option-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 5px;
          color: #29323c;
          font-size: 12px;
          font-weight: 800;
        }

        .oc-location-option-title span {
          font-size: 17px;
        }

        .oc-location-option p {
          margin: 0;
          color: #7a8491;
          font-size: 10px;
          line-height: 1.45;
        }

        .oc-address-box {
          padding: 15px;
          margin-bottom: 15px;
          background: #fafbfc;
          border: 1px solid #edf0f3;
          border-radius: 12px;
        }

        .oc-address-label {
          display: block;
          margin-bottom: 8px;
          color: #374151;
          font-size: 11px;
          font-weight: 800;
        }

        .oc-address-row {
          display: flex;
          gap: 9px;
        }

        .oc-address-input {
          flex: 1;
          min-width: 0;
          height: 43px;
          padding: 0 13px;
          background: #ffffff;
          border: 1px solid #dfe3e8;
          border-radius: 9px;
          outline: none;
          color: #20252b;
          font-family: inherit;
          font-size: 11px;
        }

        .oc-address-button {
          min-height: 43px;
          padding: 0 15px;
          border: 1px solid #d7193f;
          border-radius: 9px;
          background: #d7193f;
          color: #ffffff;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .oc-address-button:disabled {
          opacity: .65;
          cursor: wait;
        }

        .oc-address-help {
          margin-top: 7px;
          color: #8a94a0;
          font-size: 9px;
        }

        .oc-location-info {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
          padding: 12px 13px;
          background: #f8f9fb;
          border: 1px solid #edf0f3;
          border-radius: 10px;
        }

        .oc-location-info-icon {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border-radius: 8px;
        }

        .oc-location-status {
          color: #687381;
          font-size: 10px;
          line-height: 1.45;
        }

        .oc-location-status.ok {
          color: #16834c;
          font-weight: 700;
        }

        .oc-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 4px;
        }

        .oc-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 17px;
          border-radius: 10px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .oc-button-gps {
          background: #ffffff;
          color: #4b5563;
          border: 1px solid #dfe3e8;
        }

        .oc-button-register {
          background: #d7193f;
          color: #ffffff;
          border: 1px solid #d7193f;
        }

        .oc-button:disabled {
          opacity: .65;
          cursor: wait;
        }

        .oc-map-header {
          padding: 19px 22px;
          border-bottom: 1px solid #edf0f3;
        }

        .oc-map {
          width: 100%;
          min-height: 390px;
          position: relative;
        }

        .oc-map button {
          display: none !important;
        }

        .oc-history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 22px;
          border-bottom: 1px solid #edf0f3;
        }

        .oc-history-count {
          padding: 6px 10px;
          background: #f6f7f9;
          color: #65707c;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
        }

        .oc-empty {
          padding: 35px 20px;
          text-align: center;
          color: #8a94a0;
          font-size: 12px;
        }

        .oc-empty-icon {
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 10px;
          background: #f7f8fa;
          border-radius: 12px;
          font-size: 20px;
        }

        .oc-history-list {
          display: grid;
          gap: 10px;
          padding: 16px 22px 22px;
        }

        .oc-history-item {
          position: relative;
          display: grid;
          grid-template-columns: 42px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 13px;
          background: #fafbfc;
          border: 1px solid #edf0f3;
          border-radius: 11px;
        }

        .oc-history-item::before {
          content: "";
          position: absolute;
          left: 0;
          top: 9px;
          bottom: 9px;
          width: 3px;
          background: #d7193f;
          border-radius: 0 4px 4px 0;
        }

        .oc-history-icon {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border: 1px solid #e7eaee;
          border-radius: 9px;
          font-size: 17px;
        }

        .oc-history-main strong {
          display: block;
          margin-bottom: 4px;
          color: #29323c;
          font-size: 11px;
          font-weight: 800;
        }

        .oc-history-main p {
          margin: 0;
          color: #697482;
          font-size: 10px;
          line-height: 1.45;
        }

        .oc-history-meta {
          text-align: right;
          color: #8a94a0;
          font-size: 9px;
          line-height: 1.5;
        }

        .oc-coordinates {
          margin-top: 4px;
          color: #9aa2ab;
        }

        .oc-history-address {
          margin-top: 4px;
          color: #687381;
          max-width: 260px;
        }

        @media (max-width: 900px) {

          .oc-type-grid {
            grid-template-columns: repeat(2, 1fr);
          }

        }

        @media (max-width: 650px) {

          .oc-header {
            flex-direction: column;
          }

          .oc-type-grid,
          .oc-location-options {
            grid-template-columns: 1fr;
          }

          .oc-address-row,
          .oc-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .oc-button,
          .oc-address-button {
            width: 100%;
          }

          .oc-history-item {
            grid-template-columns: 40px 1fr;
          }

          .oc-history-meta {
            grid-column: 2;
            text-align: left;
          }
        }

      `}</style>

      {/* CABEÇALHO */}

      <div className="oc-header">

        <div className="oc-title-area">

          <h2>
            Registrar ocorrência
          </h2>

          <p>
            Informe o problema encontrado e
            marque onde a ocorrência aconteceu.
          </p>

        </div>

        <div className="oc-counter">

          <span className="oc-counter-icon">
            ⚠️
          </span>

          {ocorrencias.length}{" "}
          {ocorrencias.length === 1
            ? "ocorrência"
            : "ocorrências"}

        </div>

      </div>

      {/* TIPO */}

      <section className="oc-card">

        <div className="oc-card-header">

          <div className="oc-header-icon">
            ⚠️
          </div>

          <div>

            <h3>
              Tipo de ocorrência
            </h3>

            <p>
              Selecione o problema identificado
            </p>

          </div>

        </div>

        <div className="oc-types">

          <span className="oc-section-label">
            Qual problema foi identificado?
          </span>

          <div className="oc-type-grid">

            {tiposOcorrencia.map(
              (tipo) => (

                <button
                  key={tipo.id}
                  type="button"
                  className={`oc-type-button ${
                    tipoSelecionado ===
                    tipo.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setTipoSelecionado(
                      tipo.id
                    )
                  }
                >

                  <span className="oc-type-icon">
                    {tipo.icone}
                  </span>

                  <span className="oc-type-info">

                    <span className="oc-type-name">
                      {tipo.nome}
                    </span>

                    <span className="oc-type-description">
                      {tipo.descricao}
                    </span>

                  </span>

                  <span className="oc-check">
                    ✓
                  </span>

                </button>

              )
            )}

          </div>

        </div>

        {/* DESCRIÇÃO */}

        <div className="oc-description">

          <span className="oc-section-label">
            Descrição da ocorrência
          </span>

          <textarea
            value={descricao}
            onChange={(e) =>
              setDescricao(
                e.target.value
              )
            }
            placeholder="Descreva o que aconteceu..."
          />

        </div>

      </section>

      {/* LOCALIZAÇÃO */}

      <section className="oc-location-card">

        <div className="oc-location-header">

          <div className="oc-location-icon">
            📍
          </div>

          <div>

            <h3>
              Localização da ocorrência
            </h3>

            <p>
              A localização principal vem do
              GPS do ESP32.
            </p>

          </div>

        </div>

        <div className="oc-location-content">

          {/* OPÇÕES */}

          <div className="oc-location-options">

            <div
              className="oc-location-option"
              onClick={obterLocalizacao}
            >

              <div className="oc-location-option-title">

                <span>
                  🛰️
                </span>

                Usar GPS do ESP32

              </div>

              <p>
                Usa a localização recebida pelo
                módulo GPS NEO-6M conectado ao ESP32.
              </p>

            </div>

            <div
              className="oc-location-option"
              onClick={() => {

                document
                  .getElementById(
                    "oc-endereco-input"
                  )
                  ?.focus();

              }}
            >

              <div className="oc-location-option-title">

                <span>
                  🏠
                </span>

                Informar endereço

              </div>

              <p>
                Use esta opção como alternativa
                quando o GPS não estiver disponível.
              </p>

            </div>

          </div>

          {/* EQUIPAMENTO */}

          {equipamentoSelecionado && (

            <div
              style={{
                marginBottom: "15px",
                padding: "11px 13px",
                background: "#fff9fa",
                border: "1px solid #f3d5db",
                borderRadius: "10px",
                color: "#5f6670",
                fontSize: "10px",
              }}
            >

              <strong
                style={{
                  color: "#29323c",
                }}
              >
                Equipamento selecionado:
              </strong>{" "}

              {equipamentoSelecionado.nome}

              {" • "}

              ESP32:{" "}

              {equipamentoSelecionado.device_id}

            </div>

          )}

          {/* ENDEREÇO */}

          <div className="oc-address-box">

            <label
              className="oc-address-label"
              htmlFor="oc-endereco-input"
            >
              📍 Endereço da ocorrência
            </label>

            <div className="oc-address-row">

              <input
                id="oc-endereco-input"
                className="oc-address-input"
                type="text"
                value={endereco}
                onChange={(e) =>
                  setEndereco(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {

                  if (
                    e.key ===
                    "Enter"
                  ) {

                    buscarEndereco();

                  }

                }}
                placeholder="Endereço automático pelo GPS ou digite manualmente"
              />

              <button
                type="button"
                className="oc-address-button"
                onClick={
                  buscarEndereco
                }
                disabled={
                  buscandoEndereco
                }
              >

                {buscandoEndereco
                  ? "🔎 Localizando..."
                  : "🔎 Localizar endereço"}

              </button>

            </div>

            <div className="oc-address-help">

              Ao usar o GPS do ESP32, o sistema
              tenta preencher este endereço
              automaticamente.

            </div>

          </div>

          {/* STATUS */}

          <div className="oc-location-info">

            <div className="oc-location-info-icon">

              {latitude !==
                undefined
                ? "✓"
                : "🛰️"}

            </div>

            <div
              className={`oc-location-status ${
                latitude !==
                undefined
                  ? "ok"
                  : ""
              }`}
            >

              {mensagemLocalizacao}

              {latitude !==
                undefined &&
                longitude !==
                undefined && (

                  <div
                    style={{
                      marginTop:
                        "5px",
                    }}
                  >

                    📍 Latitude:{" "}
                    {latitude.toFixed(
                      6
                    )}

                    <br />

                    📍 Longitude:{" "}
                    {longitude.toFixed(
                      6
                    )}

                  </div>

                )}

            </div>

          </div>

          {/* BOTÕES */}

          <div className="oc-actions">

            <button
              type="button"
              className="oc-button oc-button-gps"
              onClick={
                obterLocalizacao
              }
              disabled={
                localizando ||
                buscandoEndereco
              }
            >

              {localizando
                ? "⏳ Consultando GPS..."
                : "🛰️ Usar GPS do ESP32"}

            </button>

            <button
              type="button"
              className="oc-button oc-button-register"
              onClick={
                registrarOcorrencia
              }
              disabled={
                enviando
              }
            >

              {enviando
                ? "⏳ Registrando..."
                : "🚨 Registrar ocorrência"}

            </button>

          </div>

        </div>

      </section>

      {/* MAPA */}

      <section className="oc-map-card">

        <div className="oc-map-header">

          <h3>
            Localização da ocorrência
          </h3>

          <p>
            O ponto selecionado será exibido
            no mapa via satélite.
          </p>

        </div>

        <div className="oc-map">

          <MapaOperacional
            latitude={
              latitude ??
              -23.5505
            }
            longitude={
              longitude ??
              -46.6333
            }
          />

        </div>

      </section>

      {/* HISTÓRICO */}

      <section className="oc-history">

        <div className="oc-history-header">

          <div>

            <h3>
              Ocorrências registradas
            </h3>

            <p>
              Histórico dos problemas informados
              pelos operadores.
            </p>

          </div>

          <span className="oc-history-count">

            {ocorrencias.length} registro
            {ocorrencias.length === 1
              ? ""
              : "s"}

          </span>

        </div>

        {ocorrencias.length ===
        0 ? (

          <div className="oc-empty">

            <div className="oc-empty-icon">
              📋
            </div>

            Nenhuma ocorrência registrada
            ainda.

          </div>

        ) : (

          <div className="oc-history-list">

            {[...ocorrencias]
              .reverse()
              .map(
                (
                  ocorrencia
                ) => {

                  const tipo =
                    tiposOcorrencia.find(
                      (item) =>
                        item.nome ===
                        ocorrencia.tipo
                    );

                  return (

                    <div
                      className="oc-history-item"
                      key={
                        ocorrencia.id
                      }
                    >

                      <div className="oc-history-icon">

                        {tipo?.icone ||
                          "⚠️"}

                      </div>

                      <div className="oc-history-main">

                        <strong>
                          {ocorrencia.tipo}
                        </strong>

                        <p>
                          {ocorrencia.descricao}
                        </p>

                      </div>

                      <div className="oc-history-meta">

                        <div>
                          {ocorrencia.data ||
                            "-"}
                        </div>

                        {ocorrencia.endereco && (

                          <div className="oc-history-address">

                            🏠{" "}
                            {
                              ocorrencia.endereco
                            }

                          </div>

                        )}

                        {ocorrencia.latitude !==
                          undefined &&
                          ocorrencia.longitude !==
                          undefined && (

                            <div className="oc-coordinates">

                              📍{" "}
                              {ocorrencia.latitude.toFixed(
                                4
                              )}
                              ,{" "}
                              {ocorrencia.longitude.toFixed(
                                4
                              )}

                            </div>

                          )}

                      </div>

                    </div>

                  );

                }
              )}

          </div>

        )}

      </section>

    </div>
  );
}