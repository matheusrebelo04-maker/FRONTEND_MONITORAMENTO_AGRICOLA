import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import "./App.css";

import MapaOperacional from "./components/MapaOperacional";
import Ocorrencias from "./pages/Ocorrencias";

type Pagina =
  | "dashboard"
  | "ocorrencias"
  | "relatorios"
  | "equipamentos"
  | "usuarios";

type Perfil = "ADMIN" | "OPERADOR";

interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}

interface Ocorrencia {
  id: number;
  tipo: string;
  descricao: string;
  latitude?: number;
  longitude?: number;
  data?: string;
  endereco?: string;
}

interface EquipamentoCadastro {
  id: number;
  device_id: string;
  nome: string;
  local: string;
  ativo: boolean;
}

interface Equipamento {
  id: string;
  nome: string;
  local: string;

  risco:
    | "Baixo"
    | "Médio"
    | "Alto"
    | "Crítico";

  temperatura: number;
  umidade: number;
  inclinacao: number;
  alerta: string;

  score?: number;

  accel_x?: number;
  accel_y?: number;
  accel_z?: number;

  latitude?: number;
  longitude?: number;
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

interface LoginResponse {
  token: string;
  usuario: Usuario;
}

const API_URL = "https://sompo-api-bzu4.onrender.com";

/*
 * =====================================================
 * FUNÇÕES AUXILIARES
 * =====================================================
 */

function numeroSeguro(
  valor: unknown,
  padrao = 0
): number {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : padrao;
}

function formatarRisco(
  nivel: string | null | undefined
): Equipamento["risco"] {
  const valor = String(
    nivel || ""
  )
    .trim()
    .toUpperCase();

  if (
    valor === "CRITICO" ||
    valor === "CRÍTICO"
  ) {
    return "Crítico";
  }

  if (valor === "ALTO") {
    return "Alto";
  }

  if (
    valor === "MEDIO" ||
    valor === "MÉDIO"
  ) {
    return "Médio";
  }

  return "Baixo";
}

function obterAlerta(
  telemetria: TelemetriaESP32
): string {
  if (telemetria.obstaculo === true) {
    return "⚠️ Obstáculo detectado.";
  }

  const evento = String(
    telemetria.tipo_evento || ""
  )
    .trim()
    .toUpperCase();

  if (evento === "NORMAL") {
    return "Operação normal.";
  }

  if (evento) {
    return `Evento detectado: ${telemetria.tipo_evento}.`;
  }

  return "Sem eventos registrados.";
}

function obterClasseRisco(
  risco: Equipamento["risco"]
): string {
  return risco
    .toLowerCase()
    .replace("é", "e")
    .replace("í", "i");
}

/*
 * =====================================================
 * APP
 * =====================================================
 */

function App() {
  /*
   * =====================================================
   * AUTENTICAÇÃO
   * =====================================================
   */

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  const [token, setToken] =
    useState<string | null>(
      localStorage.getItem(
        "sompo_token"
      )
    );

  const [carregandoLogin, setCarregandoLogin] =
    useState(true);

  const [emailLogin, setEmailLogin] =
    useState("");

  const [senhaLogin, setSenhaLogin] =
    useState("");

  const [erroLogin, setErroLogin] =
    useState("");

  const [entrando, setEntrando] =
    useState(false);

  /*
   * =====================================================
   * NAVEGAÇÃO
   * =====================================================
   */

  const [pagina, setPagina] =
    useState<Pagina>("dashboard");

  /*
   * =====================================================
   * OCORRÊNCIAS
   * =====================================================
   */

  const [ocorrencias, setOcorrencias] =
    useState<Ocorrencia[]>([]);

  /*
   * =====================================================
   * TELEMETRIA
   * =====================================================
   */

  const [ultimaAtualizacao, setUltimaAtualizacao] =
    useState("Aguardando dados...");

  const [telemetrias, setTelemetrias] =
    useState<TelemetriaESP32[]>([]);

  /*
   * =====================================================
   * EQUIPAMENTOS
   * =====================================================
   */

  const [equipamentos, setEquipamentos] =
    useState<Equipamento[]>([
      {
        id: "ESP001",
        nome: "Trator",
        local: "Fazenda Santa Clara",
        risco: "Baixo",

        temperatura: 0,
        umidade: 0,
        inclinacao: 0,

        alerta:
          "Aguardando dados do ESP32.",

        score: 0,

        accel_x: 0,
        accel_y: 0,
        accel_z: 0,

        latitude: undefined,
        longitude: undefined,
      },
    ]);

  const [equipamentosCadastro, setEquipamentosCadastro] =
    useState<EquipamentoCadastro[]>([]);

  const [mostrarCadastroEquipamento, setMostrarCadastroEquipamento] =
    useState(false);

  const [novoEquipamentoNome, setNovoEquipamentoNome] =
    useState("");

  const [novoEquipamentoDevice, setNovoEquipamentoDevice] =
    useState("");

  const [novoEquipamentoLocal, setNovoEquipamentoLocal] =
    useState("");

  const [mensagemEquipamento, setMensagemEquipamento] =
    useState("");

  const [salvandoEquipamento, setSalvandoEquipamento] =
    useState(false);

  /*
   * =====================================================
   * EDIÇÃO DE EQUIPAMENTO
   * =====================================================
   */

  const [equipamentoEditandoId, setEquipamentoEditandoId] =
    useState<number | null>(null);

  const [editEquipamentoNome, setEditEquipamentoNome] =
    useState("");

  const [editEquipamentoDevice, setEditEquipamentoDevice] =
    useState("");

  const [editEquipamentoLocal, setEditEquipamentoLocal] =
    useState("");

  const [salvandoEdicaoEquipamento, setSalvandoEdicaoEquipamento] =
    useState(false);

  /*
   * =====================================================
   * USUÁRIOS
   * =====================================================
   */

  const [usuarios, setUsuarios] =
    useState<Usuario[]>([]);

  const [mostrarCadastroUsuario, setMostrarCadastroUsuario] =
    useState(false);

  const [novoUsuarioNome, setNovoUsuarioNome] =
    useState("");

  const [novoUsuarioEmail, setNovoUsuarioEmail] =
    useState("");

  const [novoUsuarioSenha, setNovoUsuarioSenha] =
    useState("");

  const [novoUsuarioPerfil, setNovoUsuarioPerfil] =
    useState<Perfil>("OPERADOR");

  const [mensagemUsuario, setMensagemUsuario] =
    useState("");

  const [salvandoUsuario, setSalvandoUsuario] =
    useState(false);

  /*
   * =====================================================
   * HEADERS DA API
   * =====================================================
   */

  const headersAutenticados = () => {
    const headers: Record<
      string,
      string
    > = {
      Accept:
        "application/json",

      "Cache-Control":
        "no-cache",
    };

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    return headers;
  };

  /*
   * =====================================================
   * LOGOUT
   * =====================================================
   */

  const fazerLogout = async () => {
    const tokenAtual =
      token ||
      localStorage.getItem(
        "sompo_token"
      );

    try {
      if (tokenAtual) {
        await fetch(
          `${API_URL}/api/logout`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${tokenAtual}`,
            },
          }
        );
      }
    } catch (erro) {
      console.error(
        "Erro ao realizar logout no servidor:",
        erro
      );
    }

    localStorage.removeItem(
      "sompo_token"
    );

    localStorage.removeItem(
      "sompo_usuario"
    );

    setToken(null);
    setUsuario(null);

    setPagina("dashboard");

    setEmailLogin("");
    setSenhaLogin("");
    setErroLogin("");

    setUsuarios([]);
    setEquipamentosCadastro([]);

    setEquipamentoEditandoId(null);
    setEditEquipamentoNome("");
    setEditEquipamentoDevice("");
    setEditEquipamentoLocal("");
  };

  /*
   * =====================================================
   * VERIFICAR LOGIN EXISTENTE
   * =====================================================
   */

  useEffect(() => {
    const verificarLogin =
      async () => {
        const tokenSalvo =
          localStorage.getItem(
            "sompo_token"
          );

        const usuarioSalvo =
          localStorage.getItem(
            "sompo_usuario"
          );

        if (!tokenSalvo) {
          setCarregandoLogin(false);
          return;
        }

        try {
          const resposta =
            await fetch(
              `${API_URL}/api/me`,
              {
                method: "GET",

                headers: {
                  Accept:
                    "application/json",

                  Authorization:
                    `Bearer ${tokenSalvo}`,
                },

                cache:
                  "no-store",
              }
            );

          if (!resposta.ok) {
            localStorage.removeItem(
              "sompo_token"
            );

            localStorage.removeItem(
              "sompo_usuario"
            );

            setToken(null);
            setUsuario(null);

            setCarregandoLogin(false);

            return;
          }

          const dados =
            await resposta.json();

          const usuarioAtual =
            dados?.usuario ||
            dados;

          if (!usuarioAtual) {
            throw new Error(
              "Usuário não encontrado."
            );
          }

          setToken(
            tokenSalvo
          );

          setUsuario(
            usuarioAtual as Usuario
          );

          localStorage.setItem(
            "sompo_usuario",
            JSON.stringify(
              usuarioAtual
            )
          );
        } catch (erro) {
          console.error(
            "Erro ao validar sessão:",
            erro
          );

          /*
           * Se o backend estiver temporariamente
           * indisponível, mantemos a sessão local.
           * A próxima chamada à API poderá validar
           * novamente o token.
           */

          if (usuarioSalvo) {
            try {
              const usuarioConvertido =
                JSON.parse(
                  usuarioSalvo
                ) as Usuario;

              setToken(
                tokenSalvo
              );

              setUsuario(
                usuarioConvertido
              );
            } catch {
              localStorage.removeItem(
                "sompo_token"
              );

              localStorage.removeItem(
                "sompo_usuario"
              );

              setToken(null);
              setUsuario(null);
            }
          } else {
            localStorage.removeItem(
              "sompo_token"
            );

            localStorage.removeItem(
              "sompo_usuario"
            );

            setToken(null);
            setUsuario(null);
          }
        } finally {
          setCarregandoLogin(false);
        }
      };

    verificarLogin();
  }, []);

  /*
   * =====================================================
   * LOGIN
   * =====================================================
   */

  const entrarNoSistema = async () => {
    setErroLogin("");

    if (!emailLogin.trim() || !senhaLogin) {
      setErroLogin("Informe seu e-mail e sua senha.");
      return;
    }

    setEntrando(true);

    try {
      const resposta =
        await fetch(
          `${API_URL}/api/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              email:
                emailLogin
                  .trim()
                  .toLowerCase(),

              senha:
                senhaLogin,
            }),
          }
        );

      const textoResposta =
        await resposta.text();

      let dados:
        | LoginResponse
        | {
            erro?: string;
            mensagem?: string;
          };

      try {
        dados = textoResposta
          ? JSON.parse(
              textoResposta
            )
          : {};
      } catch {
        throw new Error(
          "O servidor retornou uma resposta inválida."
        );
      }

      if (!resposta.ok) {
        const mensagem =
          "erro" in dados &&
          dados.erro
            ? dados.erro
            : "mensagem" in dados &&
                dados.mensagem
              ? dados.mensagem
              : `Não foi possível entrar no sistema. Erro HTTP ${resposta.status}.`;

        throw new Error(
          mensagem
        );
      }

      const login =
        dados as LoginResponse;

      if (
        !login.token ||
        !login.usuario
      ) {
        throw new Error(
          "O servidor não retornou o token e o usuário."
        );
      }

      localStorage.setItem(
        "sompo_token",
        login.token
      );

      localStorage.setItem(
        "sompo_usuario",
        JSON.stringify(
          login.usuario
        )
      );

      setToken(
        login.token
      );

      setUsuario(
        login.usuario
      );

      setPagina(
        "dashboard"
      );

      setEmailLogin("");
      setSenhaLogin("");
      setErroLogin("");
    } catch (erro) {
      console.error(
        "Erro ao entrar no sistema:",
        erro
      );

      setErroLogin(
        erro instanceof Error
          ? erro.message
          : "Não foi possível entrar no sistema."
      );
    } finally {
      setEntrando(false);
    }
  };

  /*
   * =====================================================
   * BUSCAR EQUIPAMENTOS CADASTRADOS
   * =====================================================
   */

  useEffect(() => {
    if (!usuario || !token) {
      return;
    }

    const buscarEquipamentos =
      async () => {
        try {
          const resposta =
            await fetch(
              `${API_URL}/api/equipamentos?tempo=${Date.now()}`,
              {
                method: "GET",

                cache:
                  "no-store",

                headers:
                  headersAutenticados(),
              }
            );

          if (
            resposta.status === 401
          ) {
            await fazerLogout();
            return;
          }

          if (!resposta.ok) {
            console.error(
              "Erro ao buscar equipamentos:",
              resposta.status
            );

            return;
          }

          const dados =
            await resposta.json();

          const lista =
            Array.isArray(dados)
              ? dados
              : Array.isArray(
                    dados?.equipamentos
                )
                ? dados.equipamentos
                : [];

          setEquipamentosCadastro(
            lista as EquipamentoCadastro[]
          );
        } catch (erro) {
          console.error(
            "Erro ao buscar equipamentos:",
            erro
          );
        }
      };

    buscarEquipamentos();
  }, [usuario, token]);

  /*
   * =====================================================
   * MONTAR EQUIPAMENTOS DO DASHBOARD
   * =====================================================
   */

  useEffect(() => {
    if (
      equipamentosCadastro.length === 0
    ) {
      return;
    }

    const ultimosPorDevice =
      new Map<
        string,
        TelemetriaESP32
      >();

    telemetrias.forEach(
      (item) => {
        if (
          !item ||
          !item.device_id
        ) {
          return;
        }

        const anterior =
          ultimosPorDevice.get(
            item.device_id
          );

        if (!anterior) {
          ultimosPorDevice.set(
            item.device_id,
            item
          );

          return;
        }

        const dataAnterior =
          new Date(
            anterior.timestamp
          ).getTime();

        const dataAtual =
          new Date(
            item.timestamp
          ).getTime();

        if (
          dataAtual >
          dataAnterior
        ) {
          ultimosPorDevice.set(
            item.device_id,
            item
          );
        }
      }
    );

    const novosEquipamentos =
      equipamentosCadastro
        .filter(
          (item) =>
            item.ativo
        )
        .map(
          (cadastro) => {
            const ultimo =
              ultimosPorDevice.get(
                cadastro.device_id
              );

            const equipamentoBase:
              Equipamento = {
              id:
                cadastro.device_id,

              nome:
                cadastro.nome,

              local:
                cadastro.local,

              risco:
                "Baixo",

              temperatura:
                0,

              umidade:
                0,

              inclinacao:
                0,

              alerta:
                "Aguardando dados do ESP32.",

              score:
                0,

              accel_x:
                0,

              accel_y:
                0,

              accel_z:
                0,
            };

            if (!ultimo) {
              return equipamentoBase;
            }

            const latitude =
              ultimo.latitude !==
                null &&
              ultimo.latitude !==
                undefined &&
              Number.isFinite(
                Number(
                  ultimo.latitude
                )
              )
                ? Number(
                    ultimo.latitude
                  )
                : undefined;

            const longitude =
              ultimo.longitude !==
                null &&
              ultimo.longitude !==
                undefined &&
              Number.isFinite(
                Number(
                  ultimo.longitude
                )
              )
                ? Number(
                    ultimo.longitude
                  )
                : undefined;

            return {
              ...equipamentoBase,

              nome:
                ultimo.equipamento ||
                cadastro.nome,

              local:
                ultimo.local ||
                cadastro.local,

              risco:
                formatarRisco(
                  ultimo.nivel_risco
                ),

              temperatura:
                numeroSeguro(
                  ultimo.temperatura
                ),

              umidade:
                numeroSeguro(
                  ultimo.umidade
                ),

              inclinacao:
                numeroSeguro(
                  ultimo.inclinacao
                ),

              alerta:
                obterAlerta(
                  ultimo
                ),

              score:
                numeroSeguro(
                  ultimo.score_risco
                ),

              accel_x:
                numeroSeguro(
                  ultimo.accel_x
                ),

              accel_y:
                numeroSeguro(
                  ultimo.accel_y
                ),

              accel_z:
                numeroSeguro(
                  ultimo.accel_z
                ),

              latitude,

              longitude,
            };
          }
        );

    if (
      novosEquipamentos.length > 0
    ) {
      setEquipamentos(
        novosEquipamentos
      );
    }
  }, [
    equipamentosCadastro,
    telemetrias,
  ]);

  /*
   * =====================================================
   * TELEMETRIA EM TEMPO REAL
   * =====================================================
   */

  useEffect(() => {
    if (!usuario || !token) {
      return;
    }

    let ativo = true;

    const buscarTelemetria =
      async () => {
        try {
          const resposta =
            await fetch(
              `${API_URL}/api/telemetria?tempo=${Date.now()}`,
              {
                method: "GET",

                cache:
                  "no-store",

                headers:
                  headersAutenticados(),
              }
            );

          if (
            resposta.status === 401
          ) {
            await fazerLogout();
            return;
          }

          if (!resposta.ok) {
            throw new Error(
              `Erro HTTP ${resposta.status}`
            );
          }

          const dados =
            (await resposta.json()) as
              TelemetriaESP32[];

          if (!Array.isArray(dados)) {
            return;
          }

          if (!ativo) {
            return;
          }

          setTelemetrias(dados);

          if (
            dados.length === 0
          ) {
            return;
          }

          const ultimoGeral =
            [...dados]
              .filter(
                (item) =>
                  item &&
                  item.timestamp
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.timestamp
                  ).getTime() -
                  new Date(
                    a.timestamp
                  ).getTime()
              )[0];

          if (
            ultimoGeral?.timestamp
          ) {
            const dataTelemetria =
              new Date(
                ultimoGeral.timestamp
              );

            if (
              !isNaN(
                dataTelemetria.getTime()
              )
            ) {
              setUltimaAtualizacao(
                dataTelemetria.toLocaleString(
                  "pt-BR"
                )
              );
            } else {
              setUltimaAtualizacao(
                ultimoGeral.timestamp
              );
            }
          }
        } catch (erro) {
          console.error(
            "❌ Erro ao buscar telemetria do ESP32:",
            erro
          );
        }
      };

    buscarTelemetria();

    const intervalo =
      setInterval(
        buscarTelemetria,
        1000
      );

    return () => {
      ativo = false;

      clearInterval(
        intervalo
      );
    };
  }, [usuario, token]);

  /*
   * =====================================================
   * OCORRÊNCIAS
   * =====================================================
   */

  const adicionarOcorrencia =
    (
      ocorrencia: Ocorrencia
    ) => {
      setOcorrencias(
        (anteriores) => [
          ...anteriores,
          ocorrencia,
        ]
      );
    };

  /*
   * =====================================================
   * CONTADORES
   * =====================================================
   */

  const equipamentosAltoRisco =
    equipamentos.filter(
      (equipamento) =>
        equipamento.risco ===
        "Alto"
    ).length;

  const equipamentosMedioRisco =
    equipamentos.filter(
      (equipamento) =>
        equipamento.risco ===
        "Médio"
    ).length;

  const equipamentosBaixoRisco =
    equipamentos.filter(
      (equipamento) =>
        equipamento.risco ===
        "Baixo"
    ).length;

  const equipamentosCriticos =
    equipamentos.filter(
      (equipamento) =>
        equipamento.risco ===
        "Crítico"
    ).length;

  /*
   * =====================================================
   * CADASTRAR EQUIPAMENTO
   * =====================================================
   */

  const cadastrarEquipamento =
    async (
      evento: FormEvent
    ) => {
      evento.preventDefault();

      setMensagemEquipamento("");

      if (
        !novoEquipamentoNome.trim() ||
        !novoEquipamentoDevice.trim() ||
        !novoEquipamentoLocal.trim()
      ) {
        setMensagemEquipamento(
          "Preencha todos os campos."
        );

        return;
      }

      setSalvandoEquipamento(
        true
      );

      try {
        const resposta =
          await fetch(
            `${API_URL}/api/equipamentos`,
            {
              method: "POST",

              headers: {
                ...headersAutenticados(),

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                device_id:
                  novoEquipamentoDevice
                    .trim()
                    .toUpperCase(),

                nome:
                  novoEquipamentoNome.trim(),

                local:
                  novoEquipamentoLocal.trim(),

                ativo: true,
              }),
            }
          );

        if (
          resposta.status === 401
        ) {
          await fazerLogout();
          return;
        }

        const dados =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados?.erro ||
              "Não foi possível cadastrar o equipamento."
          );
        }

        const equipamentoCriado =
          dados?.equipamento ||
          dados;

        setEquipamentosCadastro(
          (anteriores) => [
            ...anteriores,
            equipamentoCriado as EquipamentoCadastro,
          ]
        );

        setNovoEquipamentoNome("");
        setNovoEquipamentoDevice("");
        setNovoEquipamentoLocal("");

        setMostrarCadastroEquipamento(
          false
        );

        setMensagemEquipamento(
          "Equipamento cadastrado com sucesso."
        );
      } catch (erro) {
        console.error(
          "Erro ao cadastrar equipamento:",
          erro
        );

        setMensagemEquipamento(
          erro instanceof Error
            ? erro.message
            : "Erro ao cadastrar equipamento."
        );
      } finally {
        setSalvandoEquipamento(
          false
        );
      }
    };

  /*
   * =====================================================
   * INICIAR EDIÇÃO DO EQUIPAMENTO
   * =====================================================
   */

  const iniciarEdicaoEquipamento =
    (
      equipamento: EquipamentoCadastro
    ) => {
      if (
        usuario?.perfil !==
        "ADMIN"
      ) {
        return;
      }

      setEquipamentoEditandoId(
        equipamento.id
      );

      setEditEquipamentoNome(
        equipamento.nome
      );

      setEditEquipamentoDevice(
        equipamento.device_id
      );

      setEditEquipamentoLocal(
        equipamento.local
      );

      setMensagemEquipamento("");
    };

  /*
   * =====================================================
   * CANCELAR EDIÇÃO DO EQUIPAMENTO
   * =====================================================
   */

  const cancelarEdicaoEquipamento =
    () => {
      setEquipamentoEditandoId(
        null
      );

      setEditEquipamentoNome("");
      setEditEquipamentoDevice("");
      setEditEquipamentoLocal("");

      setMensagemEquipamento("");
    };

  /*
   * =====================================================
   * EDITAR EQUIPAMENTO
   * =====================================================
   */

  const editarEquipamento =
    async (
      equipamento: EquipamentoCadastro
    ) => {
      if (!token) {
        return;
      }

      if (
        !editEquipamentoNome.trim() ||
        !editEquipamentoDevice.trim() ||
        !editEquipamentoLocal.trim()
      ) {
        setMensagemEquipamento(
          "Preencha todos os campos."
        );

        return;
      }

      setSalvandoEdicaoEquipamento(
        true
      );

      setMensagemEquipamento("");

      try {
        const resposta =
          await fetch(
            `${API_URL}/api/equipamentos/${equipamento.id}`,
            {
              method: "PUT",

              headers: {
                ...headersAutenticados(),

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                device_id:
                  editEquipamentoDevice
                    .trim()
                    .toUpperCase(),

                nome:
                  editEquipamentoNome.trim(),

                local:
                  editEquipamentoLocal.trim(),

                ativo:
                  equipamento.ativo,
              }),
            }
          );

        if (
          resposta.status === 401
        ) {
          await fazerLogout();
          return;
        }

        const dados =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados?.erro ||
              "Não foi possível editar o equipamento."
          );
        }

        const equipamentoAtualizado =
          dados?.equipamento ||
          dados;

        setEquipamentosCadastro(
          (anteriores) =>
            anteriores.map(
              (item) =>
                item.id ===
                equipamento.id
                  ? {
                      ...item,

                      device_id:
                        equipamentoAtualizado?.device_id ||
                        editEquipamentoDevice
                          .trim()
                          .toUpperCase(),

                      nome:
                        equipamentoAtualizado?.nome ||
                        editEquipamentoNome
                          .trim(),

                      local:
                        equipamentoAtualizado?.local ||
                        editEquipamentoLocal
                          .trim(),

                      ativo:
                        equipamentoAtualizado?.ativo ??
                        equipamento.ativo,
                    }
                  : item
            )
        );

        setEquipamentoEditandoId(
          null
        );

        setEditEquipamentoNome("");
        setEditEquipamentoDevice("");
        setEditEquipamentoLocal("");

        setMensagemEquipamento(
          "Equipamento atualizado com sucesso."
        );
      } catch (erro) {
        console.error(
          "Erro ao editar equipamento:",
          erro
        );

        setMensagemEquipamento(
          erro instanceof Error
            ? erro.message
            : "Erro ao editar equipamento."
        );
      } finally {
        setSalvandoEdicaoEquipamento(
          false
        );
      }
    };

  /*
   * =====================================================
   * ATIVAR / DESATIVAR EQUIPAMENTO
   * =====================================================
   */

  const alternarEquipamento =
    async (
      equipamento: EquipamentoCadastro
    ) => {
      if (!token) {
        return;
      }

      try {
        const resposta =
          await fetch(
            `${API_URL}/api/equipamentos/${equipamento.id}`,
            {
              method: "PUT",

              headers: {
                ...headersAutenticados(),

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                ativo:
                  !equipamento.ativo,
              }),
            }
          );

        if (
          resposta.status === 401
        ) {
          await fazerLogout();
          return;
        }

        const dados =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados?.erro ||
              "Não foi possível alterar o equipamento."
          );
        }

        const equipamentoAtualizado =
          dados?.equipamento ||
          dados;

        setEquipamentosCadastro(
          (anteriores) =>
            anteriores.map(
              (item) =>
                item.id ===
                equipamento.id
                  ? {
                      ...item,

                      ativo:
                        equipamentoAtualizado?.ativo ??
                        !item.ativo,
                    }
                  : item
            )
        );
      } catch (erro) {
        console.error(
          "Erro ao alterar equipamento:",
          erro
        );

        alert(
          erro instanceof Error
            ? erro.message
            : "Erro ao alterar equipamento."
        );
      }
    };

  /*
   * =====================================================
   * CADASTRAR USUÁRIO
   * =====================================================
   */

  const cadastrarUsuario =
    async (
      evento: FormEvent
    ) => {
      evento.preventDefault();

      setMensagemUsuario("");

      if (
        !novoUsuarioNome.trim() ||
        !novoUsuarioEmail.trim() ||
        !novoUsuarioSenha
      ) {
        setMensagemUsuario(
          "Preencha todos os campos."
        );

        return;
      }

      setSalvandoUsuario(
        true
      );

      try {
        const resposta =
          await fetch(
            `${API_URL}/api/usuarios`,
            {
              method: "POST",

              headers: {
                ...headersAutenticados(),

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                nome:
                  novoUsuarioNome.trim(),

                email:
                  novoUsuarioEmail
                    .trim()
                    .toLowerCase(),

                senha:
                  novoUsuarioSenha,

                perfil:
                  novoUsuarioPerfil,

                ativo: true,
              }),
            }
          );

        if (
          resposta.status === 401
        ) {
          await fazerLogout();
          return;
        }

        const dados =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados?.erro ||
              "Não foi possível cadastrar o usuário."
          );
        }

        const usuarioCriado =
          dados?.usuario ||
          dados;

        setUsuarios(
          (anteriores) => [
            ...anteriores,
            usuarioCriado as Usuario,
          ]
        );

        setNovoUsuarioNome("");
        setNovoUsuarioEmail("");
        setNovoUsuarioSenha("");
        setNovoUsuarioPerfil(
          "OPERADOR"
        );

        setMostrarCadastroUsuario(
          false
        );

        setMensagemUsuario(
          "Usuário cadastrado com sucesso."
        );
      } catch (erro) {
        console.error(
          "Erro ao cadastrar usuário:",
          erro
        );

        setMensagemUsuario(
          erro instanceof Error
            ? erro.message
            : "Erro ao cadastrar usuário."
        );
      } finally {
        setSalvandoUsuario(
          false
        );
      }
    };

  /*
   * =====================================================
   * BUSCAR USUÁRIOS
   * =====================================================
   */

  useEffect(() => {
    if (
      !usuario ||
      !token ||
      usuario.perfil !==
        "ADMIN"
    ) {
      return;
    }

    const buscarUsuarios =
      async () => {
        try {
          const resposta =
            await fetch(
              `${API_URL}/api/usuarios?tempo=${Date.now()}`,
              {
                method: "GET",

                cache:
                  "no-store",

                headers:
                  headersAutenticados(),
              }
            );

          if (
            resposta.status === 401
          ) {
            await fazerLogout();
            return;
          }

          if (!resposta.ok) {
            return;
          }

          const dados =
            await resposta.json();

          const lista =
            Array.isArray(dados)
              ? dados
              : Array.isArray(
                    dados?.usuarios
                )
                ? dados.usuarios
                : [];

          setUsuarios(
            lista as Usuario[]
          );
        } catch (erro) {
          console.error(
            "Erro ao buscar usuários:",
            erro
          );
        }
      };

    buscarUsuarios();
  }, [
    usuario,
    token,
  ]);

  /*
   * =====================================================
   * ATIVAR / DESATIVAR USUÁRIO
   * =====================================================
   */

  const alternarUsuario =
    async (
      usuarioSelecionado: Usuario
    ) => {
      if (!token) {
        return;
      }

      if (
        usuarioSelecionado.id ===
        usuario?.id
      ) {
        alert(
          "O usuário atualmente conectado não pode ser desativado por aqui."
        );

        return;
      }

      try {
        const resposta =
          await fetch(
            `${API_URL}/api/usuarios/${usuarioSelecionado.id}`,
            {
              method: "PUT",

              headers: {
                ...headersAutenticados(),

                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                ativo:
                  !usuarioSelecionado.ativo,
              }),
            }
          );

        if (
          resposta.status === 401
        ) {
          await fazerLogout();
          return;
        }

        const dados =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados?.erro ||
              "Não foi possível alterar o usuário."
          );
        }

        const usuarioAtualizado =
          dados?.usuario ||
          dados;

        setUsuarios(
          (anteriores) =>
            anteriores.map(
              (item) =>
                item.id ===
                usuarioSelecionado.id
                  ? {
                      ...item,

                      ativo:
                        usuarioAtualizado?.ativo ??
                        !item.ativo,
                    }
                  : item
            )
        );
      } catch (erro) {
        console.error(
          "Erro ao alterar usuário:",
          erro
        );

        alert(
          erro instanceof Error
            ? erro.message
            : "Erro ao alterar usuário."
        );
      }
    };

  /*
   * =====================================================
   * RELATÓRIO
   * =====================================================
   */

  const gerarRelatorio = () => {
    const dataAtual =
      new Date().toLocaleString(
        "pt-BR"
      );

    const linhasEquipamentos =
      equipamentos
        .map(
          (equipamento) => `
          <tr>
            <td>${equipamento.id}</td>
            <td>${equipamento.nome}</td>
            <td>${equipamento.local}</td>
            <td>${equipamento.risco}</td>
            <td>${equipamento.temperatura.toFixed(
              1
            )} °C</td>
            <td>${equipamento.umidade.toFixed(
              1
            )}%</td>
            <td>${equipamento.inclinacao.toFixed(
              2
            )}°</td>
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
                      ocorrencia.latitude !==
                      undefined
                        ? ocorrencia.latitude.toFixed(
                            5
                          )
                        : "-"
                    }
                  </td>
                  <td>
                    ${
                      ocorrencia.longitude !==
                      undefined
                        ? ocorrencia.longitude.toFixed(
                            5
                          )
                        : "-"
                    }
                  </td>
                  <td>
                    ${
                      ocorrencia.endereco ||
                      "-"
                    }
                  </td>
                  <td>
                    ${
                      ocorrencia.data ||
                      "-"
                    }
                  </td>
                </tr>
              `
            )
            .join("")
        : `
          <tr>
            <td colspan="6">
              Nenhuma ocorrência registrada.
            </td>
          </tr>
        `;

    const conteudo = `
      <!DOCTYPE html>
      <html lang="pt-BR">

      <head>
        <meta charset="UTF-8" />

        <title>
          Relatório Geral - Sompo
        </title>

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

          <div class="logo">
            Sompo
          </div>

          <h1>
            Relatório Geral de Monitoramento Agrícola
          </h1>

          <div class="data">
            Gerado em: ${dataAtual}
          </div>

        </div>

        <h2>
          Resumo operacional
        </h2>

        <div class="resumo">

          <div class="card">
            <span>
              Equipamentos monitorados
            </span>

            <strong>
              ${equipamentos.length}
            </strong>
          </div>

          <div class="card">
            <span>
              Alto risco
            </span>

            <strong>
              ${equipamentosAltoRisco}
            </strong>
          </div>

          <div class="card">
            <span>
              Risco médio
            </span>

            <strong>
              ${equipamentosMedioRisco}
            </strong>
          </div>

          <div class="card">
            <span>
              Operação normal
            </span>

            <strong>
              ${equipamentosBaixoRisco}
            </strong>
          </div>

        </div>

        <h2>
          Equipamentos monitorados
        </h2>

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
              <th>Alerta</th>
            </tr>

          </thead>

          <tbody>
            ${linhasEquipamentos}
          </tbody>

        </table>

        <h2>
          Ocorrências registradas
        </h2>

        <table>

          <thead>

            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Endereço</th>
              <th>Data</th>
            </tr>

          </thead>

          <tbody>
            ${linhasOcorrencias}
          </tbody>

        </table>

        <h2>
          Situação de risco
        </h2>

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
              <td>
                ${equipamentosBaixoRisco}
              </td>
            </tr>

            <tr>
              <td>Médio</td>
              <td>
                ${equipamentosMedioRisco}
              </td>
            </tr>

            <tr>
              <td>Alto</td>
              <td>
                ${equipamentosAltoRisco}
              </td>
            </tr>

            <tr>
              <td>Crítico</td>
              <td>
                ${equipamentosCriticos}
              </td>
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

    const janela =
      window.open(
        "",
        "_blank"
      );

    if (!janela) {
      alert(
        "Não foi possível abrir o relatório. Verifique se o navegador bloqueou o pop-up."
      );

      return;
    }

    janela.document.open();

    janela.document.write(
      conteudo
    );

    janela.document.close();

    janela.focus();
  };

  /*
   * =====================================================
   * TELA DE CARREGAMENTO
   * =====================================================
   */

  if (carregandoLogin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f7f6",
        }}
      >
        <strong>
          Carregando sistema...
        </strong>
      </div>
    );
  }

  /*
   * =====================================================
   * TELA DE LOGIN
   * =====================================================
   */

  if (!usuario || !token) {
    return (
      <div
        style={{
          minHeight: "100vh",

          background:
            "linear-gradient(135deg, #f4f7f6 0%, #ffffff 100%)",

          display: "flex",

          alignItems: "center",

          justifyContent: "center",

          padding: "20px",
        }}
      >
        <div
          style={{
            width: "100%",

            maxWidth: "430px",

            background:
              "#ffffff",

            borderRadius:
              "16px",

            padding:
              "40px",

            boxShadow:
              "0 10px 40px rgba(0,0,0,0.10)",

            border:
              "1px solid #e5e5e5",
          }}
        >
          <div
            style={{
              textAlign:
                "center",

              marginBottom:
                "30px",
            }}
          >
            <div
              style={{
                width: "64px",

                height: "64px",

                margin:
                  "0 auto 15px",

                borderRadius:
                  "14px",

                background:
                  "#d7193f",

                color:
                  "#ffffff",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                fontSize:
                  "32px",

                fontWeight:
                  "800",
              }}
            >
              S
            </div>

            <h1
              style={{
                margin: 0,

                fontSize:
                  "28px",

                color:
                  "#20252b",
              }}
            >
              Sompo
            </h1>

            <p
              style={{
                marginTop:
                  "8px",

                color:
                  "#666",
              }}
            >
              Monitoramento Agrícola
            </p>
          </div>

          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              entrarNoSistema();
            }}
          >
            <p
              style={{
                marginBottom: "22px",

                color: "#666",

                fontSize: "15px",

                lineHeight: "1.5",

                textAlign: "center",
              }}
            >
              Acesse o sistema de
              monitoramento agrícola
              para continuar.
            </p>

            {erroLogin && (
              <div
                style={{
                  background: "#fff0f2",

                  border: "1px solid #f2b8c2",

                  color: "#b51235",

                  padding: "12px",

                  borderRadius: "8px",

                  marginBottom: "18px",

                  fontSize: "14px",
                }}
              >
                {erroLogin}
              </div>
            )}

            <label
              style={{
                display: "block",

                marginBottom: "7px",

                color: "#333",

                fontSize: "14px",

                fontWeight: "600",
              }}
            >
              E-mail
            </label>

            <input
              type="email"
              value={emailLogin}
              onChange={(evento) => {
                setEmailLogin(
                  evento.target.value
                );
                setErroLogin("");
              }}
              placeholder="Digite seu e-mail"
              autoComplete="username"
              disabled={entrando}
              style={{
                width: "100%",

                boxSizing: "border-box",

                border: "1px solid #d8d8d8",

                borderRadius: "8px",

                padding: "13px 12px",

                marginBottom: "16px",

                fontSize: "15px",

                outline: "none",
              }}
            />

            <label
              style={{
                display: "block",

                marginBottom: "7px",

                color: "#333",

                fontSize: "14px",

                fontWeight: "600",
              }}
            >
              Senha
            </label>

            <input
              type="password"
              value={senhaLogin}
              onChange={(evento) => {
                setSenhaLogin(
                  evento.target.value
                );
                setErroLogin("");
              }}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              disabled={entrando}
              style={{
                width: "100%",

                boxSizing: "border-box",

                border: "1px solid #d8d8d8",

                borderRadius: "8px",

                padding: "13px 12px",

                marginBottom: "20px",

                fontSize: "15px",

                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={
                entrando
              }
              style={{
                width: "100%",

                border: 0,

                borderRadius: "8px",

                padding: "14px",

                background: "#d7193f",

                color: "#ffffff",

                fontSize: "15px",

                fontWeight: "700",

                cursor:
                  entrando
                    ? "wait"
                    : "pointer",

                opacity:
                  entrando
                    ? 0.7
                    : 1,
              }}
            >
              {entrando
                ? "Entrando..."
                : "Entrar no sistema"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /*
   * =====================================================
   * SISTEMA
   * =====================================================
   */

  /*
   * =====================================================
   * INDICADORES VISUAIS DOS SENSORES
   * =====================================================
   */

  const equipamentoAtual = equipamentos[0];

  const temperaturaAtual = numeroSeguro(
    equipamentoAtual?.temperatura
  );

  const umidadeAtual = numeroSeguro(
    equipamentoAtual?.umidade
  );

  const inclinacaoAtual = Math.abs(
    numeroSeguro(
      equipamentoAtual?.inclinacao
    )
  );

  const accelXAtual = numeroSeguro(
    equipamentoAtual?.accel_x
  );

  const accelYAtual = numeroSeguro(
    equipamentoAtual?.accel_y
  );

  const accelZAtual = numeroSeguro(
    equipamentoAtual?.accel_z
  );

  const aceleracaoAtual = Math.sqrt(
    accelXAtual ** 2 +
    accelYAtual ** 2 +
    accelZAtual ** 2
  );

  const riscoAceleracaoVisual =
    aceleracaoAtual <= 1.2
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            ((aceleracaoAtual - 1.2) / 2.8) * 100
          )
        );

  const riscoInclinacaoVisual =
    inclinacaoAtual <= 10
      ? 0
      : inclinacaoAtual <= 45
        ? ((inclinacaoAtual - 10) / 35) * 70
        : inclinacaoAtual <= 60
          ? 70 + ((inclinacaoAtual - 45) / 15) * 15
          : inclinacaoAtual <= 75
            ? 85 + ((inclinacaoAtual - 60) / 15) * 10
            : 95 + Math.min(5, ((inclinacaoAtual - 75) / 15) * 5);

  const riscoMpuVisual = Math.round(
    Math.max(
      riscoAceleracaoVisual,
      riscoInclinacaoVisual
    )
  );

  const nivelMpuVisual =
    riscoMpuVisual >= 90
      ? "CRÍTICO"
      : riscoMpuVisual >= 70
        ? "ALTO"
        : riscoMpuVisual >= 40
          ? "MÉDIO"
          : "BAIXO";

  const dhtAlerta =
    temperaturaAtual < 18 ||
    temperaturaAtual > 30 ||
    umidadeAtual < 30;

  const nivelDhtVisual = dhtAlerta
    ? "ATENÇÃO"
    : "BAIXO";

  const obstaculoVisual =
    equipamentoAtual?.alerta
      ?.toLowerCase()
      .includes("obstáculo") ||
    equipamentoAtual?.alerta
      ?.toLowerCase()
      .includes("obstaculo");

  const corNivelVisual = (
    nivel: string
  ) => {
    if (nivel === "CRÍTICO") return "#dc2626";
    if (nivel === "ALTO") return "#dc2626";
    if (nivel === "MÉDIO") return "#eab308";
    if (nivel === "ATENÇÃO") return "#eab308";
    return "#16a34a";
  };

  const scoreGeralVisual = Math.round(
    numeroSeguro(
      equipamentoAtual?.score
    )
  );


  return (
    <div className="app">

      <header className="header">

        <div className="logo-area">

          <div className="logo-icon">
            S
          </div>

          <div>
            <h1>
              Sompo
            </h1>

            <span>
              Monitoramento Agrícola
            </span>
          </div>

        </div>

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "18px",
          }}
        >
          <div className="status">

            <span className="status-dot"></span>

            Sistema operacional

          </div>

          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "10px",
            }}
          >
            <span
              style={{
                fontSize:
                  "13px",

                color:
                  "#555",
              }}
            >
              {usuario.nome} ·{" "}
              {usuario.perfil}
            </span>

            <button
              onClick={
                fazerLogout
              }
              style={{
                border:
                  "1px solid #ddd",

                background:
                  "#ffffff",

                borderRadius:
                  "7px",

                padding:
                  "7px 12px",

                cursor:
                  "pointer",
              }}
            >
              Sair
            </button>
          </div>
        </div>

      </header>

      <nav className="menu">

        <button
          className={
            pagina ===
            "dashboard"
              ? "menu-active"
              : ""
          }
          onClick={() =>
            setPagina(
              "dashboard"
            )
          }
        >
          📊 Dashboard
        </button>

        <button
          className={
            pagina ===
            "ocorrencias"
              ? "menu-active"
              : ""
          }
          onClick={() =>
            setPagina(
              "ocorrencias"
            )
          }
        >
          ⚠️ Ocorrências
        </button>

        <button
          className={
            pagina ===
            "relatorios"
              ? "menu-active"
              : ""
          }
          onClick={() =>
            setPagina(
              "relatorios"
            )
          }
        >
          📄 Relatórios
        </button>

        <button
          className={
            pagina ===
            "equipamentos"
              ? "menu-active"
              : ""
          }
          onClick={() =>
            setPagina(
              "equipamentos"
            )
          }
        >
          🚜 Equipamentos
        </button>

        {usuario.perfil ===
          "ADMIN" && (
          <button
            className={
              pagina ===
              "usuarios"
                ? "menu-active"
                : ""
            }
            onClick={() =>
              setPagina(
                "usuarios"
              )
            }
          >
            👥 Usuários
          </button>
        )}

      </nav>

      <main className="content">

        {/* =================================================
            DASHBOARD
            ================================================= */}

        {pagina ===
          "dashboard" && (
          <>

            <section className="welcome">

              <div>

                <h2>
                  Monitoramento Agrícola
                </h2>

                <p>
                  Acompanhe em tempo real
                  as condições dos
                  equipamentos e identifique
                  situações de risco.
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
                    Dados recebidos dos
                    dispositivos em campo
                  </p>

                </div>

              </div>

              <div className="equipment-grid">

                {equipamentos.map(
                  (
                    equipamento
                  ) => (

                    <div
                      className="equipment-card"
                      key={
                        equipamento.id
                      }
                    >

                      <div className="equipment-header">

                        <div>

                          <strong>
                            {
                              equipamento.id
                            }
                          </strong>

                          <span>
                            {
                              equipamento.nome
                            }
                          </span>

                        </div>

                        <span
                          className={`risk-badge risk-${obterClasseRisco(
                            equipamento.risco
                          )}`}
                        >
                          {
                            equipamento.risco
                          }
                        </span>

                      </div>

                      <p className="equipment-location">
                        📍{" "}
                        {
                          equipamento.local
                        }
                      </p>

                      <div className="sensor-grid">

                        <div className="sensor">

                          <span>
                            🌡️
                          </span>

                          <small>
                            Temperatura
                          </small>

                          <strong>
                            {equipamento.temperatura.toFixed(
                              1
                            )}
                            °C
                          </strong>

                        </div>

                        <div className="sensor">

                          <span>
                            💧
                          </span>

                          <small>
                            Umidade
                          </small>

                          <strong>
                            {equipamento.umidade.toFixed(
                              1
                            )}
                            %
                          </strong>

                        </div>

                        <div className="sensor">

                          <span>
                            📊
                          </span>

                          <small>
                            Aceleração X
                          </small>

                          <strong>
                            {equipamento.accel_x?.toFixed(
                              2
                            )}{" "}
                            G
                          </strong>

                        </div>

                        <div className="sensor">

                          <span>
                            📊
                          </span>

                          <small>
                            Aceleração Y
                          </small>

                          <strong>
                            {equipamento.accel_y?.toFixed(
                              2
                            )}{" "}
                            G
                          </strong>

                        </div>

                        <div className="sensor">

                          <span>
                            📊
                          </span>

                          <small>
                            Aceleração Z
                          </small>

                          <strong>
                            {equipamento.accel_z?.toFixed(
                              2
                            )}{" "}
                            G
                          </strong>

                        </div>

                        <div className="sensor">

                          <span>
                            📐
                          </span>

                          <small>
                            Inclinação
                          </small>

                          <strong>
                            {equipamento.inclinacao.toFixed(
                              2
                            )}
                            °
                          </strong>

                        </div>

                        <div className="sensor">

                          <span>
                            ⚠️
                          </span>

                          <small>
                            Nível de risco
                          </small>

                          <strong>
                            {
                              equipamento.risco
                            }
                          </strong>

                        </div>

                        <div className="sensor">

                          <span>
                            🎯
                          </span>

                          <small>
                            Score
                          </small>

                          <strong>
                            {equipamento.score?.toFixed(
                              0
                            ) ?? "0"}
                          </strong>

                        </div>

                      </div>

                      <div className="equipment-alert">

                        <span>
                          ⚠️
                        </span>

                        <div>

                          <small>
                            Status
                          </small>

                          <p>
                            {
                              equipamento.alerta
                            }
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
                      Monitoramento atual
                      dos equipamentos
                    </p>

                  </div>

                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "14px",
                    padding: "4px 0 8px",
                  }}
                >

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#5b6b7f",
                        letterSpacing: "0.04em",
                      }}
                    >
                      MONITORAMENTO EM TEMPO REAL
                    </span>

                    <span
                      style={{
                        padding: "7px 12px",
                        borderRadius: "999px",
                        background: "#f4f7f6",
                        color: "#17324d",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      Score geral: {scoreGeralVisual}/100
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                    }}
                  >

                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        background: dhtAlerta ? "#fff8e8" : "#effaf3",
                        border: `1px solid ${dhtAlerta ? "#f2d38a" : "#cdebd7"}`,
                        display: "grid",
                        gridTemplateColumns: "48px 1fr auto",
                        gap: "14px",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          background: dhtAlerta ? "#fff0c7" : "#dff5e7",
                          fontSize: "21px",
                        }}
                      >
                        🌡️
                      </div>

                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "#17324d",
                            fontSize: "15px",
                          }}
                        >
                          DHT22 — Temperatura e Umidade
                        </strong>

                        <span
                          style={{
                            display: "block",
                            marginTop: "5px",
                            color: "#34495e",
                            fontSize: "14px",
                          }}
                        >
                          {temperaturaAtual.toFixed(1)} °C &nbsp;|&nbsp; {umidadeAtual.toFixed(1)}%
                        </span>

                        <span
                          style={{
                            display: "block",
                            marginTop: "5px",
                            color: corNivelVisual(nivelDhtVisual),
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          {dhtAlerta
                            ? "Condição ambiental fora do parâmetro normal."
                            : "Temperatura e umidade normais."}
                        </span>
                      </div>

                      <span
                        style={{
                          padding: "7px 12px",
                          borderRadius: "999px",
                          background: dhtAlerta ? "#fff0c7" : "#dff5e7",
                          color: corNivelVisual(nivelDhtVisual),
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        {nivelDhtVisual}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        background: riscoMpuVisual >= 40 ? "#fff5f5" : "#effaf3",
                        border: `1px solid ${riscoMpuVisual >= 40 ? "#f3c8cf" : "#cdebd7"}`,
                        display: "grid",
                        gridTemplateColumns: "48px 1fr auto",
                        gap: "14px",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          background: riscoMpuVisual >= 40 ? "#ffe2e7" : "#dff5e7",
                          fontSize: "21px",
                        }}
                      >
                        📐
                      </div>

                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "#17324d",
                            fontSize: "15px",
                          }}
                        >
                          MPU6050 — Inclinação e Aceleração
                        </strong>

                        <span
                          style={{
                            display: "block",
                            marginTop: "5px",
                            color: "#34495e",
                            fontSize: "14px",
                          }}
                        >
                          Inclinação: {inclinacaoAtual.toFixed(2)}° &nbsp;|&nbsp; Aceleração: {aceleracaoAtual.toFixed(2)} G
                        </span>

                        <span
                          style={{
                            display: "block",
                            marginTop: "5px",
                            color: corNivelVisual(nivelMpuVisual),
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          {riscoMpuVisual >= 90
                            ? "Condição crítica detectada. Risco de tombamento ou movimento intenso."
                            : riscoMpuVisual >= 70
                              ? "Condição de alto risco detectada pelo MPU6050."
                              : riscoMpuVisual >= 40
                                ? "Atenção: movimento ou inclinação acima do esperado."
                                : "Inclinação e aceleração dentro dos parâmetros normais."}
                        </span>
                      </div>

                      <span
                        style={{
                          padding: "7px 12px",
                          borderRadius: "999px",
                          background: riscoMpuVisual >= 40 ? "#ffe2e7" : "#dff5e7",
                          color: corNivelVisual(nivelMpuVisual),
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        {nivelMpuVisual}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        background: obstaculoVisual ? "#fff5f5" : "#effaf3",
                        border: `1px solid ${obstaculoVisual ? "#f3c8cf" : "#cdebd7"}`,
                        display: "grid",
                        gridTemplateColumns: "48px 1fr auto",
                        gap: "14px",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          background: obstaculoVisual ? "#ffe2e7" : "#dff5e7",
                          fontSize: "21px",
                        }}
                      >
                        🚧
                      </div>

                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "#17324d",
                            fontSize: "15px",
                          }}
                        >
                          Obstáculos
                        </strong>

                        <span
                          style={{
                            display: "block",
                            marginTop: "5px",
                            color: obstaculoVisual ? "#dc2626" : "#16a34a",
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        >
                          {obstaculoVisual
                            ? "Obstáculo identificado na área."
                            : "Nenhum obstáculo detectado na área."}
                        </span>
                      </div>

                      <span
                        style={{
                          padding: "7px 12px",
                          borderRadius: "999px",
                          background: obstaculoVisual ? "#ffe2e7" : "#dff5e7",
                          color: obstaculoVisual ? "#dc2626" : "#16a34a",
                          fontSize: "12px",
                          fontWeight: 800,
                        }}
                      >
                        {obstaculoVisual ? "ALTO" : "BAIXO"}
                      </span>
                    </div>

                  </div>

                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      background: scoreGeralVisual >= 70 ? "#fff5f5" : "#fffaf0",
                      border: `1px solid ${scoreGeralVisual >= 70 ? "#f3c8cf" : "#f1d79b"}`,
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        color: "#8a5a00",
                        fontSize: "13px",
                      }}
                    >
                      Atenção operacional
                    </strong>

                    <span
                      style={{
                        display: "block",
                        marginTop: "4px",
                        color: "#6b5a3b",
                        fontSize: "13px",
                      }}
                    >
                      {equipamentoAtual?.alerta ||
                        "Aguardando dados do ESP32 para atualizar o monitoramento."}
                    </span>
                  </div>

                </div>

              </div>

              <div className="panel">

                <div className="panel-header">

                  <div>

                    <h3>
                      Distribuição de risco
                    </h3>

                    <p>
                      Situação dos
                      equipamentos
                    </p>

                  </div>

                </div>

                <div className="risk-list">

                  <div className="risk-row">

                    <span>
                      🟢 Baixo
                    </span>

                    <strong>
                      {
                        equipamentosBaixoRisco
                      }
                    </strong>

                  </div>

                  <div className="risk-row">

                    <span>
                      🟡 Médio
                    </span>

                    <strong>
                      {
                        equipamentosMedioRisco
                      }
                    </strong>

                  </div>

                  <div className="risk-row">

                    <span>
                      🔴 Alto
                    </span>

                    <strong>
                      {
                        equipamentosAltoRisco
                      }
                    </strong>

                  </div>

                  <div className="risk-row">

                    <span>
                      ⚫ Crítico
                    </span>

                    <strong>
                      {
                        equipamentosCriticos
                      }
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
                    GPS do ESP32 e
                    ocorrências registradas
                  </p>

                </div>

                <div className="map-actions">

                  <button
                    className="secondary-button"
                    onClick={() =>
                      alert(
                        equipamentoComGPS(
                          equipamentos
                        )
                      )
                    }
                  >
                    🛰️ GPS do ESP32
                  </button>

                  <button
                    className="primary-button"
                    onClick={() =>
                      setPagina(
                        "ocorrencias"
                      )
                    }
                  >
                    + Registrar ocorrência
                  </button>

                </div>

              </div>

              <MapaOperacional
                ocorrencias={
                  ocorrencias
                }
                onSessaoExpirada={
                  fazerLogout
                }
              />

            </section>

          </>
        )}

        {/* =================================================
            OCORRÊNCIAS
            ================================================= */}

        {pagina ===
          "ocorrencias" && (
          <Ocorrencias
            ocorrencias={
              ocorrencias
            }
            adicionarOcorrencia={
              adicionarOcorrencia
            }
          />
        )}

        {/* =================================================
            RELATÓRIOS
            ================================================= */}

        {pagina ===
          "relatorios" && (

          <section className="panel reports-page">

            <div className="panel-header">

              <div>

                <h2>
                  Relatórios
                </h2>

                <p>
                  Gere um relatório geral
                  de todos os
                  monitoramentos.
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
                O relatório reúne
                informações dos
                equipamentos, níveis de
                risco, sensores e
                ocorrências registradas.
              </p>

              <button
                className="primary-button"
                onClick={
                  gerarRelatorio
                }
              >
                📄 Gerar relatório
              </button>

            </div>

          </section>

        )}

        {/* =================================================
            EQUIPAMENTOS
            ================================================= */}

        {pagina ===
          "equipamentos" && (

          <section className="panel">

            <div
              className="panel-header"
            >

              <div>

                <h2>
                  Equipamentos
                </h2>

                <p>
                  Cadastro e vinculação
                  dos dispositivos ESP32.
                </p>

              </div>

              {usuario.perfil ===
                "ADMIN" && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setMostrarCadastroEquipamento(
                      !mostrarCadastroEquipamento
                    );

                    setMensagemEquipamento(
                      ""
                    );
                  }}
                >
                  + Cadastrar equipamento
                </button>
              )}

            </div>

            {usuario.perfil ===
              "OPERADOR" && (
              <div
                style={{
                  background:
                    "#f4f7f6",

                  border:
                    "1px solid #ddd",

                  borderRadius:
                    "8px",

                  padding:
                    "14px",

                  marginBottom:
                    "20px",

                  color:
                    "#555",
                }}
              >
                Você possui acesso para
                consultar os equipamentos,
                mas somente ADMIN pode
                cadastrar ou alterar
                dispositivos.
              </div>
            )}

            {mostrarCadastroEquipamento &&
              usuario.perfil ===
                "ADMIN" && (

              <form
                onSubmit={
                  cadastrarEquipamento
                }
                style={{
                  background:
                    "#fafafa",

                  border:
                    "1px solid #ddd",

                  borderRadius:
                    "10px",

                  padding:
                    "20px",

                  marginBottom:
                    "25px",
                }}
              >

                <h3>
                  Novo equipamento
                </h3>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(200px, 1fr))",

                    gap:
                      "15px",

                    marginTop:
                      "15px",
                  }}
                >

                  <div>
                    <label>
                      Nome do equipamento
                    </label>

                    <input
                      value={
                        novoEquipamentoNome
                      }
                      onChange={(
                        evento
                      ) =>
                        setNovoEquipamentoNome(
                          evento.target
                            .value
                        )
                      }
                      placeholder="Ex.: Trator"
                      required
                      style={{
                        width:
                          "100%",

                        padding:
                          "11px",

                        marginTop:
                          "6px",

                        border:
                          "1px solid #ccc",

                        borderRadius:
                          "7px",
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      ID do ESP32
                    </label>

                    <input
                      value={
                        novoEquipamentoDevice
                      }
                      onChange={(
                        evento
                      ) =>
                        setNovoEquipamentoDevice(
                          evento.target
                            .value
                        )
                      }
                      placeholder="Ex.: ESP002"
                      required
                      style={{
                        width:
                          "100%",

                        padding:
                          "11px",

                        marginTop:
                          "6px",

                        border:
                          "1px solid #ccc",

                        borderRadius:
                          "7px",

                        textTransform:
                          "uppercase",
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      Local
                    </label>

                    <input
                      value={
                        novoEquipamentoLocal
                      }
                      onChange={(
                        evento
                      ) =>
                        setNovoEquipamentoLocal(
                          evento.target
                            .value
                        )
                      }
                      placeholder="Ex.: Fazenda Santa Clara"
                      required
                      style={{
                        width:
                          "100%",

                        padding:
                          "11px",

                        marginTop:
                          "6px",

                        border:
                          "1px solid #ccc",

                        borderRadius:
                          "7px",
                      }}
                    />
                  </div>

                </div>

                {mensagemEquipamento && (
                  <p
                    style={{
                      marginTop:
                        "15px",

                      color:
                        mensagemEquipamento.includes(
                          "sucesso"
                        )
                          ? "#16833b"
                          : "#c5163d",
                    }}
                  >
                    {
                      mensagemEquipamento
                    }
                  </p>
                )}

                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "10px",

                    marginTop:
                      "18px",
                  }}
                >

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      salvandoEquipamento
                    }
                  >
                    {salvandoEquipamento
                      ? "Salvando..."
                      : "Salvar equipamento"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setMostrarCadastroEquipamento(
                        false
                      )
                    }
                  >
                    Cancelar
                  </button>

                </div>

              </form>
            )}

            {mensagemEquipamento &&
              !mostrarCadastroEquipamento &&
              equipamentoEditandoId ===
                null && (
              <p
                style={{
                  marginBottom:
                    "18px",

                  color:
                    mensagemEquipamento.includes(
                      "sucesso"
                    )
                      ? "#16833b"
                      : "#c5163d",

                  fontWeight:
                    "600",
                }}
              >
                {
                  mensagemEquipamento
                }
              </p>
            )}

            <div
              style={{
                display:
                  "grid",

                gap:
                  "15px",
              }}
            >

              {equipamentosCadastro.length ===
                0 ? (

                <div
                  style={{
                    padding:
                      "30px",

                    textAlign:
                      "center",

                    color:
                      "#777",
                  }}
                >
                  Nenhum equipamento
                  cadastrado ainda.
                </div>

              ) : (

                equipamentosCadastro.map(
                  (
                    equipamento
                  ) => (

                    <div
                      key={
                        equipamento.id
                      }
                      style={{
                        border:
                          "1px solid #ddd",

                        borderRadius:
                          "10px",

                        padding:
                          "18px",

                        background:
                          "#ffffff",
                      }}
                    >

                      {equipamentoEditandoId ===
                      equipamento.id ? (

                        <div>

                          <h3
                            style={{
                              marginTop:
                                0,

                              marginBottom:
                                "15px",
                            }}
                          >
                            Editar equipamento
                          </h3>

                          <div
                            style={{
                              display:
                                "grid",

                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(200px, 1fr))",

                              gap:
                                "15px",
                            }}
                          >

                            <div>
                              <label>
                                Nome do equipamento
                              </label>

                              <input
                                value={
                                  editEquipamentoNome
                                }
                                onChange={(
                                  evento
                                ) =>
                                  setEditEquipamentoNome(
                                    evento.target
                                      .value
                                  )
                                }
                                placeholder="Ex.: Trator"
                                style={{
                                  width:
                                    "100%",

                                  padding:
                                    "11px",

                                  marginTop:
                                    "6px",

                                  border:
                                    "1px solid #ccc",

                                  borderRadius:
                                    "7px",
                                }}
                              />
                            </div>

                            <div>
                              <label>
                                ID do ESP32
                              </label>

                              <input
                                value={
                                  editEquipamentoDevice
                                }
                                onChange={(
                                  evento
                                ) =>
                                  setEditEquipamentoDevice(
                                    evento.target
                                      .value
                                  )
                                }
                                placeholder="Ex.: ESP002"
                                style={{
                                  width:
                                    "100%",

                                  padding:
                                    "11px",

                                  marginTop:
                                    "6px",

                                  border:
                                    "1px solid #ccc",

                                  borderRadius:
                                    "7px",

                                  textTransform:
                                    "uppercase",
                                }}
                              />
                            </div>

                            <div>
                              <label>
                                Local
                              </label>

                              <input
                                value={
                                  editEquipamentoLocal
                                }
                                onChange={(
                                  evento
                                ) =>
                                  setEditEquipamentoLocal(
                                    evento.target
                                      .value
                                  )
                                }
                                placeholder="Ex.: Fazenda Santa Clara"
                                style={{
                                  width:
                                    "100%",

                                  padding:
                                    "11px",

                                  marginTop:
                                    "6px",

                                  border:
                                    "1px solid #ccc",

                                  borderRadius:
                                    "7px",
                                }}
                              />
                            </div>

                          </div>

                          {mensagemEquipamento && (
                            <p
                              style={{
                                marginTop:
                                  "15px",

                                color:
                                  mensagemEquipamento.includes(
                                    "sucesso"
                                  )
                                    ? "#16833b"
                                    : "#c5163d",

                                fontWeight:
                                  "600",
                              }}
                            >
                              {
                                mensagemEquipamento
                              }
                            </p>
                          )}

                          <div
                            style={{
                              display:
                                "flex",

                              gap:
                                "10px",

                              marginTop:
                                "18px",

                              flexWrap:
                                "wrap",
                            }}
                          >

                            <button
                              type="button"
                              className="primary-button"
                              disabled={
                                salvandoEdicaoEquipamento
                              }
                              onClick={() =>
                                editarEquipamento(
                                  equipamento
                                )
                              }
                            >
                              {salvandoEdicaoEquipamento
                                ? "Salvando..."
                                : "Salvar alterações"}
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              disabled={
                                salvandoEdicaoEquipamento
                              }
                              onClick={
                                cancelarEdicaoEquipamento
                              }
                            >
                              Cancelar
                            </button>

                          </div>

                        </div>

                      ) : (

                        <div
                          style={{
                            display:
                              "flex",

                            justifyContent:
                              "space-between",

                            alignItems:
                              "center",

                            gap:
                              "20px",

                            flexWrap:
                              "wrap",
                          }}
                        >

                          <div>

                            <strong
                              style={{
                                display:
                                  "block",

                                fontSize:
                                  "17px",
                              }}
                            >
                              {
                                equipamento.nome
                              }
                            </strong>

                            <span
                              style={{
                                display:
                                  "block",

                                marginTop:
                                  "5px",

                                color:
                                  "#666",
                              }}
                            >
                              ESP32:{" "}
                              {
                                equipamento.device_id
                              }
                            </span>

                            <span
                              style={{
                                display:
                                  "block",

                                marginTop:
                                  "3px",

                                color:
                                  "#666",
                              }}
                            >
                              Local:{" "}
                              {
                                equipamento.local
                              }
                            </span>

                          </div>

                          <div
                            style={{
                              display:
                                "flex",

                              alignItems:
                                "center",

                              gap:
                                "10px",

                              flexWrap:
                                "wrap",
                            }}
                          >

                            <span
                              style={{
                                padding:
                                  "6px 12px",

                                borderRadius:
                                  "20px",

                                background:
                                  equipamento.ativo
                                    ? "#e8f7ed"
                                    : "#f4f4f4",

                                color:
                                  equipamento.ativo
                                    ? "#16833b"
                                    : "#777",

                                fontWeight:
                                  "700",

                                fontSize:
                                  "13px",
                              }}
                            >
                              {equipamento.ativo
                                ? "Ativo"
                                : "Inativo"}
                            </span>

                            {usuario.perfil ===
                              "ADMIN" && (
                              <>
                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    iniciarEdicaoEquipamento(
                                      equipamento
                                    )
                                  }
                                >
                                  ✏️ Editar
                                </button>

                                <button
                                  className="secondary-button"
                                  onClick={() =>
                                    alternarEquipamento(
                                      equipamento
                                    )
                                  }
                                >
                                  {equipamento.ativo
                                    ? "Desativar"
                                    : "Ativar"}
                                </button>
                              </>
                            )}

                          </div>

                        </div>

                      )}

                    </div>

                  )
                )

              )}

            </div>

          </section>

        )}

        {/* =================================================
            USUÁRIOS — SOMENTE ADMIN
            ================================================= */}

        {pagina ===
          "usuarios" &&
          usuario.perfil ===
            "ADMIN" && (

          <section className="panel">

            <div
              className="panel-header"
            >

              <div>

                <h2>
                  Usuários
                </h2>

                <p>
                  Controle de acesso ao
                  sistema Sompo.
                </p>

              </div>

              <button
                className="primary-button"
                onClick={() => {
                  setMostrarCadastroUsuario(
                    !mostrarCadastroUsuario
                  );

                  setMensagemUsuario(
                    ""
                  );
                }}
              >
                + Cadastrar usuário
              </button>

            </div>

            {mostrarCadastroUsuario && (

              <form
                onSubmit={
                  cadastrarUsuario
                }
                style={{
                  background:
                    "#fafafa",

                  border:
                    "1px solid #ddd",

                  borderRadius:
                    "10px",

                  padding:
                    "20px",

                  marginBottom:
                    "25px",
                }}
              >

                <h3>
                  Novo usuário
                </h3>

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(200px, 1fr))",

                    gap:
                      "15px",

                    marginTop:
                      "15px",
                  }}
                >

                  <div>
                    <label>
                      Nome
                    </label>

                    <input
                      value={
                        novoUsuarioNome
                      }
                      onChange={(
                        evento
                      ) =>
                        setNovoUsuarioNome(
                          evento.target
                            .value
                        )
                      }
                      placeholder="Nome do usuário"
                      required
                      style={{
                        width:
                          "100%",

                        padding:
                          "11px",

                        marginTop:
                          "6px",

                        border:
                          "1px solid #ccc",

                        borderRadius:
                          "7px",
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      E-mail
                    </label>

                    <input
                      type="email"
                      value={
                        novoUsuarioEmail
                      }
                      onChange={(
                        evento
                      ) =>
                        setNovoUsuarioEmail(
                          evento.target
                            .value
                        )
                      }
                      placeholder="usuario@email.com"
                      required
                      style={{
                        width:
                          "100%",

                        padding:
                          "11px",

                        marginTop:
                          "6px",

                        border:
                          "1px solid #ccc",

                        borderRadius:
                          "7px",
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      Senha
                    </label>

                    <input
                      type="password"
                      value={
                        novoUsuarioSenha
                      }
                      onChange={(
                        evento
                      ) =>
                        setNovoUsuarioSenha(
                          evento.target
                            .value
                        )
                      }
                      placeholder="Senha de acesso"
                      required
                      minLength={
                        6
                      }
                      style={{
                        width:
                          "100%",

                        padding:
                          "11px",

                        marginTop:
                          "6px",

                        border:
                          "1px solid #ccc",

                        borderRadius:
                          "7px",
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      Perfil
                    </label>

                    <select
                      value={
                        novoUsuarioPerfil
                      }
                      onChange={(
                        evento
                      ) =>
                        setNovoUsuarioPerfil(
                          evento.target
                            .value as Perfil
                        )
                      }
                      style={{
                        width:
                          "100%",

                        padding:
                          "11px",

                        marginTop:
                          "6px",

                        border:
                          "1px solid #ccc",

                        borderRadius:
                          "7px",

                        background:
                          "#ffffff",
                      }}
                    >
                      <option value="OPERADOR">
                        OPERADOR
                      </option>

                      <option value="ADMIN">
                        ADMIN
                      </option>
                    </select>
                  </div>

                </div>

                {mensagemUsuario && (
                  <p
                    style={{
                      marginTop:
                        "15px",

                      color:
                        mensagemUsuario.includes(
                          "sucesso"
                        )
                          ? "#16833b"
                          : "#c5163d",
                    }}
                  >
                    {
                      mensagemUsuario
                    }
                  </p>
                )}

                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "10px",

                    marginTop:
                      "18px",
                  }}
                >

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      salvandoUsuario
                    }
                  >
                    {salvandoUsuario
                      ? "Salvando..."
                      : "Salvar usuário"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setMostrarCadastroUsuario(
                        false
                      )
                    }
                  >
                    Cancelar
                  </button>

                </div>

              </form>
            )}

            <div
              style={{
                display:
                  "grid",

                gap:
                  "15px",
              }}
            >

              {usuarios.length ===
                0 ? (

                <div
                  style={{
                    padding:
                      "30px",

                    textAlign:
                      "center",

                    color:
                      "#777",
                  }}
                >
                  Nenhum usuário
                  encontrado.
                </div>

              ) : (

                usuarios.map(
                  (
                    usuarioItem
                  ) => (

                    <div
                      key={
                        usuarioItem.id
                      }
                      style={{
                        border:
                          "1px solid #ddd",

                        borderRadius:
                          "10px",

                        padding:
                          "18px",

                        background:
                          "#ffffff",

                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        alignItems:
                          "center",

                        gap:
                          "20px",

                        flexWrap:
                          "wrap",
                      }}
                    >

                      <div>

                        <strong
                          style={{
                            display:
                              "block",

                            fontSize:
                              "17px",
                          }}
                        >
                          {
                            usuarioItem.nome
                          }
                        </strong>

                        <span
                          style={{
                            display:
                              "block",

                            marginTop:
                              "5px",

                            color:
                              "#666",
                          }}
                        >
                          {
                            usuarioItem.email
                          }
                        </span>

                        <span
                          style={{
                            display:
                              "inline-block",

                            marginTop:
                              "8px",

                            padding:
                              "4px 9px",

                            borderRadius:
                              "15px",

                            background:
                              usuarioItem.perfil ===
                              "ADMIN"
                                ? "#fff0f2"
                                : "#f4f7f6",

                            color:
                              usuarioItem.perfil ===
                              "ADMIN"
                                ? "#d7193f"
                                : "#555",

                            fontSize:
                              "12px",

                            fontWeight:
                              "700",
                          }}
                        >
                          {
                            usuarioItem.perfil
                          }
                        </span>

                      </div>

                      <div
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap:
                            "10px",
                        }}
                      >

                        <span
                          style={{
                            padding:
                              "6px 12px",

                            borderRadius:
                              "20px",

                            background:
                              usuarioItem.ativo
                                ? "#e8f7ed"
                                : "#f4f4f4",

                            color:
                              usuarioItem.ativo
                                ? "#16833b"
                                : "#777",

                            fontWeight:
                              "700",

                            fontSize:
                              "13px",
                          }}
                        >
                          {usuarioItem.ativo
                            ? "Ativo"
                            : "Inativo"}
                        </span>

                        <button
                          className="secondary-button"
                          disabled={
                            usuarioItem.id ===
                            usuario.id
                          }
                          onClick={() =>
                            alternarUsuario(
                              usuarioItem
                            )
                          }
                        >
                          {usuarioItem.ativo
                            ? "Desativar"
                            : "Ativar"}
                        </button>

                      </div>

                    </div>

                  )
                )

              )}

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

/*
 * =====================================================
 * FUNÇÃO AUXILIAR DO GPS
 * =====================================================
 */

function equipamentoComGPS(
  equipamentos: Equipamento[]
): string {
  const equipamento =
    equipamentos.find(
      (item) =>
        item.latitude !==
          undefined &&
        item.longitude !==
          undefined
    );

  if (!equipamento) {
    return "Aguardando posição GPS válida do ESP32.";
  }

  return `GPS ${equipamento.id}\nLatitude: ${equipamento.latitude?.toFixed(
    6
  )}\nLongitude: ${equipamento.longitude?.toFixed(
    6
  )}`;
}

export default App;

