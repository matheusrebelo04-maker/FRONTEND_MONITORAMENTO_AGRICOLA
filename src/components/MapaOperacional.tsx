import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Ocorrencia {
  id: number;
  tipo: string;
  descricao: string;
  latitude?: number;
  longitude?: number;
  data?: string;
  endereco?: string;
  nivel_risco?: string;
  score_risco?: number;
  equipamento?: string;
  device_id?: string;
}

interface MapaOperacionalProps {
  latitude?: number;
  longitude?: number;
  ocorrencias?: Ocorrencia[];
  onSessaoExpirada?: () => void;
}

interface TelemetriaGPS {
  latitude?: number;
  longitude?: number;
  gps_latitude?: number;
  gps_longitude?: number;
}

const API_URL = "https://sompo-api-bzu4.onrender.com";

/* =========================================================
   ÍCONE DA OCORRÊNCIA
========================================================= */

const iconeOcorrencia = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width:38px;
      height:38px;
      background:#c8102e;
      border:4px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 3px 10px rgba(0,0,0,.35);
      display:flex;
      align-items:center;
      justify-content:center;
    ">
      <span style="
        transform:rotate(45deg);
        color:white;
        font-size:17px;
      ">
        ⚠
      </span>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
});

/* =========================================================
   ÍCONE DO TRATOR
========================================================= */

const iconeLocalizacao = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width:42px;
      height:42px;
      background:#1479d1;
      border:4px solid white;
      border-radius:50%;
      box-shadow:0 3px 12px rgba(0,0,0,.4);
      display:flex;
      align-items:center;
      justify-content:center;
      color:white;
      font-size:18px;
    ">
      🚜
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

/* =========================================================
   CORRIGIR TAMANHO DO MAPA
========================================================= */

function CorrigirTamanhoMapa() {
  const mapa = useMap();

  useEffect(() => {
    const ajustarMapa = () => {
      mapa.invalidateSize();
    };

    ajustarMapa();

    const timer1 = setTimeout(() => {
      mapa.invalidateSize();
    }, 300);

    const timer2 = setTimeout(() => {
      mapa.invalidateSize();
    }, 1000);

    window.addEventListener("resize", ajustarMapa);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener("resize", ajustarMapa);
    };
  }, [mapa]);

  return null;
}

/* =========================================================
   CENTRALIZAR MAPA
========================================================= */

function CentralizarMapa({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const mapa = useMap();

  useEffect(() => {
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      mapa.setView(
        [latitude, longitude],
        17,
        {
          animate: true,
        }
      );

      setTimeout(() => {
        mapa.invalidateSize();
      }, 200);
    }
  }, [latitude, longitude, mapa]);

  return null;
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */

export default function MapaOperacional({
  latitude = -23.5505,
  longitude = -46.6333,
  ocorrencias: ocorrenciasIniciais = [],
  onSessaoExpirada,
}: MapaOperacionalProps) {
  /* =======================================================
     POSIÇÃO ATUAL
  ======================================================= */

  const [localizacao, setLocalizacao] = useState({
    latitude,
    longitude,
  });

  /* =======================================================
     STATUS GPS
  ======================================================= */

  const [gpsAtivo, setGpsAtivo] = useState(false);

  /* =======================================================
     OCORRÊNCIAS
  ======================================================= */

  const [ocorrencias, setOcorrencias] =
    useState<Ocorrencia[]>(ocorrenciasIniciais);

  /* =======================================================
     ATUALIZAR OCORRÊNCIAS RECEBIDAS PELO APP
  ======================================================= */

  useEffect(() => {
    setOcorrencias(ocorrenciasIniciais);
  }, [ocorrenciasIniciais]);

  /* =======================================================
     BUSCAR GPS DO ESP32
  ======================================================= */

  useEffect(() => {
    let ativo = true;

    async function buscarGPS() {
      const token =
        localStorage.getItem("sompo_token");

      if (!token) {
        if (ativo) {
          setGpsAtivo(false);
        }
        return;
      }

      try {
        const resposta = await fetch(
          `${API_URL}/api/telemetria?tempo=${Date.now()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (resposta.status === 401) {
          console.warn(
            "Sessão expirada ao consultar GPS."
          );

          if (ativo) {
            setGpsAtivo(false);
          }

          onSessaoExpirada?.();
          return;
        }

        if (!resposta.ok) {
          throw new Error(
            `Erro HTTP ${resposta.status}`
          );
        }

        const dados =
          await resposta.json();

        let listaTelemetria: TelemetriaGPS[] = [];

        /* API RETORNANDO ARRAY */

        if (Array.isArray(dados)) {
          listaTelemetria = dados;
        }

        /* API RETORNANDO { dados: [...] } */

        else if (
          dados?.dados &&
          Array.isArray(dados.dados)
        ) {
          listaTelemetria = dados.dados;
        }

        /* API RETORNANDO { telemetria: [...] } */

        else if (
          dados?.telemetria &&
          Array.isArray(dados.telemetria)
        ) {
          listaTelemetria =
            dados.telemetria;
        }

        /* API RETORNANDO UM OBJETO */

        else if (
          dados &&
          typeof dados === "object"
        ) {
          listaTelemetria = [dados];
        }

        /* PROCURAR A ÚLTIMA POSIÇÃO GPS VÁLIDA */

        let ultimaPosicaoValida:
          | {
              latitude: number;
              longitude: number;
            }
          | null = null;

        for (
          let i =
            listaTelemetria.length - 1;
          i >= 0;
          i--
        ) {
          const item =
            listaTelemetria[i];

          const lat = Number(
            item.latitude ??
              item.gps_latitude
          );

          const lon = Number(
            item.longitude ??
              item.gps_longitude
          );

          if (
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            lat !== 0 &&
            lon !== 0 &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
          ) {
            ultimaPosicaoValida = {
              latitude: lat,
              longitude: lon,
            };

            break;
          }
        }

        /* GPS ENCONTRADO */

        if (ultimaPosicaoValida) {
          if (ativo) {
            setLocalizacao(
              ultimaPosicaoValida
            );

            setGpsAtivo(true);
          }
        } else {
          if (ativo) {
            setGpsAtivo(false);
          }
        }
      } catch (erro) {
        console.error(
          "Erro ao buscar GPS do ESP32:",
          erro
        );

        if (ativo) {
          setGpsAtivo(false);
        }
      }
    }

    buscarGPS();

    const intervalo =
      setInterval(buscarGPS, 2000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [onSessaoExpirada]);

  /* =======================================================
     BUSCAR OCORRÊNCIAS
  ======================================================= */

  useEffect(() => {
    let ativo = true;

    async function buscarOcorrencias() {
      const token =
        localStorage.getItem("sompo_token");

      if (!token) {
        return;
      }

      try {
        const resposta = await fetch(
          `${API_URL}/api/ocorrencias?tempo=${Date.now()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (resposta.status === 401) {
          console.warn(
            "Sessão expirada ao consultar ocorrências."
          );

          onSessaoExpirada?.();
          return;
        }

        if (!resposta.ok) {
          throw new Error(
            `Erro HTTP ${resposta.status}`
          );
        }

        const dados =
          await resposta.json();

        let listaOcorrencias: any[] = [];

        /* API RETORNANDO ARRAY */

        if (Array.isArray(dados)) {
          listaOcorrencias = dados;
        }

        /* API RETORNANDO { ocorrencias: [...] } */

        else if (
          dados?.ocorrencias &&
          Array.isArray(
            dados.ocorrencias
          )
        ) {
          listaOcorrencias =
            dados.ocorrencias;
        }

        /* API RETORNANDO { dados: [...] } */

        else if (
          dados?.dados &&
          Array.isArray(dados.dados)
        ) {
          listaOcorrencias =
            dados.dados;
        }

        const ocorrenciasValidas =
          listaOcorrencias.filter(
            (ocorrencia) =>
              Number.isFinite(
                Number(
                  ocorrencia.latitude
                )
              ) &&
              Number.isFinite(
                Number(
                  ocorrencia.longitude
                )
              ) &&
              Number(
                ocorrencia.latitude
              ) !== 0 &&
              Number(
                ocorrencia.longitude
              ) !== 0
          );

        if (ativo) {
          setOcorrencias(
            ocorrenciasValidas
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao buscar ocorrências:",
          erro
        );
      }
    }

    buscarOcorrencias();

    const intervalo =
      setInterval(
        buscarOcorrencias,
        2000
      );

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [onSessaoExpirada]);

  /* =========================================================
     MAPA
  ========================================================= */

  return (
    <div
      className="real-map-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "500px",
        overflow: "hidden",
        borderRadius: "12px",
      }}
    >
      <MapContainer
        center={[
          localizacao.latitude,
          localizacao.longitude,
        ]}
        zoom={17}
        scrollWheelZoom={true}
        className="leaflet-map"
        style={{
          width: "100%",
          height: "100%",
          minHeight: "500px",
          borderRadius: "12px",
        }}
      >
        {/* MAPA DE SATÉLITE */}

        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        {/* CORRIGIR TAMANHO */}

        <CorrigirTamanhoMapa />

        {/* CENTRALIZAR NO GPS */}

        <CentralizarMapa
          latitude={
            localizacao.latitude
          }
          longitude={
            localizacao.longitude
          }
        />

        {/* POSIÇÃO ATUAL DO TRATOR */}

        <Marker
          position={[
            localizacao.latitude,
            localizacao.longitude,
          ]}
          icon={iconeLocalizacao}
        >
          <Popup>
            <div className="map-popup">
              <strong>
                🚜 Veículo monitorado
              </strong>

              <div
                style={{
                  marginTop: "8px",
                }}
              >
                {gpsAtivo ? (
                  <span
                    style={{
                      color: "#16a34a",
                    }}
                  >
                    ● GPS do ESP32 conectado
                  </span>
                ) : (
                  <span
                    style={{
                      color: "#dc2626",
                    }}
                  >
                    ● Aguardando GPS do ESP32
                  </span>
                )}
              </div>

              <p
                style={{
                  marginTop: "8px",
                }}
              >
                Posição atual do equipamento
              </p>

              <small>
                📍 Latitude:{" "}
                {localizacao.latitude.toFixed(
                  6
                )}
              </small>

              <br />

              <small>
                📍 Longitude:{" "}
                {localizacao.longitude.toFixed(
                  6
                )}
              </small>
            </div>
          </Popup>
        </Marker>

        {/* OCORRÊNCIAS */}

        {ocorrencias.map(
          (ocorrencia) => (
            <Marker
              key={ocorrencia.id}
              position={[
                Number(
                  ocorrencia.latitude
                ),
                Number(
                  ocorrencia.longitude
                ),
              ]}
              icon={iconeOcorrencia}
            >
              <Popup>
                <div className="map-popup">
                  <strong>
                    🚨 Local da ocorrência
                  </strong>

                  <div
                    className="popup-type"
                    style={{
                      marginTop: "8px",
                    }}
                  >
                    {ocorrencia.tipo}
                  </div>

                  <p>
                    {ocorrencia.descricao}
                  </p>

                  {ocorrencia.endereco && (
                    <div
                      style={{
                        marginBottom: "8px",
                      }}
                    >
                      <strong>
                        📍 Endereço:
                      </strong>

                      <br />

                      <small>
                        {ocorrencia.endereco}
                      </small>
                    </div>
                  )}

                  {ocorrencia.equipamento && (
                    <div>
                      <strong>
                        🚜 Equipamento:
                      </strong>{" "}
                      {ocorrencia.equipamento}
                    </div>
                  )}

                  {ocorrencia.device_id && (
                    <div>
                      <strong>
                        📡 Device ID:
                      </strong>{" "}
                      {ocorrencia.device_id}
                    </div>
                  )}

                  {ocorrencia.nivel_risco && (
                    <div>
                      <strong>
                        Risco:
                      </strong>{" "}
                      {ocorrencia.nivel_risco}
                    </div>
                  )}

                  {typeof ocorrencia.score_risco ===
                    "number" && (
                    <div>
                      <strong>
                        Score:
                      </strong>{" "}
                      {ocorrencia.score_risco}
                    </div>
                  )}

                  <br />

                  <small>
                    📍 Latitude:{" "}
                    {Number(
                      ocorrencia.latitude
                    ).toFixed(6)}
                  </small>

                  <br />

                  <small>
                    📍 Longitude:{" "}
                    {Number(
                      ocorrencia.longitude
                    ).toFixed(6)}
                  </small>

                  <br />

                  <small>
                    🕐 {ocorrencia.data}
                  </small>
                </div>
              </Popup>
            </Marker>
          )
        )}
      </MapContainer>

      {/* =====================================================
          STATUS DO GPS
      ===================================================== */}

      <div
        style={{
          position: "absolute",
          top: "15px",
          right: "15px",
          zIndex: 1000,
          background: "white",
          padding: "8px 12px",
          borderRadius: "8px",
          boxShadow:
            "0 2px 8px rgba(0,0,0,.25)",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        {gpsAtivo ? (
          <span
            style={{
              color: "#16a34a",
            }}
          >
            🛰️ GPS ESP32 ativo
          </span>
        ) : (
          <span
            style={{
              color: "#dc2626",
            }}
          >
            🛰️ Aguardando GPS
          </span>
        )}
      </div>

      {/* =====================================================
          CONTADOR DE OCORRÊNCIAS
      ===================================================== */}

      <div
        className="map-counter"
        style={{
          position: "absolute",
          bottom: "15px",
          left: "15px",
          zIndex: 1000,
          background: "white",
          padding: "8px 12px",
          borderRadius: "8px",
          boxShadow:
            "0 2px 8px rgba(0,0,0,.25)",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        🚨 {ocorrencias.length} ocorrência
        {ocorrencias.length !== 1
          ? "s"
          : ""}
      </div>
    </div>
  );
}
