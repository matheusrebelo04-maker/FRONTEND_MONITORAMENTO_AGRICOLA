import jsPDF from "jspdf";

interface Equipamento {
  id: string;
  nome: string;
  local: string;
  temperatura: number;
  umidade: number;
  inclinacao: number;
  velocidade: number;
  risco: string;
  alerta: string;
}

interface Ocorrencia {
  id: number;
  tipo: string;
  descricao: string;
  latitude: number;
  longitude: number;
  data: string;
}

export function gerarRelatorioPDF(
  equipamentos: Equipamento[],
  ocorrencias: Ocorrencia[]
) {
  const pdf = new jsPDF();

  let y = 20;

  /* CABEÇALHO */

  pdf.setFillColor(200, 16, 46);
  pdf.rect(0, 0, 210, 30, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text("SOMPO", 15, 18);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    "Monitoramento Agrícola",
    15,
    24
  );

  pdf.setTextColor(40, 40, 40);

  y = 42;

  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text(
    "RELATÓRIO GERAL DE MONITORAMENTO",
    15,
    y
  );

  y += 9;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");

  pdf.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    15,
    y
  );

  y += 15;

  /* RESUMO */

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Resumo operacional", 15, y);

  y += 9;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");

  pdf.text(
    `Equipamentos monitorados: ${equipamentos.length}`,
    15,
    y
  );

  y += 6;

  const altoRisco = equipamentos.filter(
    (e) => e.risco === "Alto"
  ).length;

  pdf.text(
    `Equipamentos em alto risco: ${altoRisco}`,
    15,
    y
  );

  y += 6;

  pdf.text(
    `Ocorrências registradas: ${ocorrencias.length}`,
    15,
    y
  );

  y += 15;

  /* EQUIPAMENTOS */

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Equipamentos monitorados", 15, y);

  y += 8;

  equipamentos.forEach((equipamento) => {

    if (y > 265) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFillColor(245, 245, 245);
    pdf.roundedRect(
      12,
      y - 5,
      186,
      42,
      3,
      3,
      "F"
    );

    pdf.setTextColor(30, 30, 30);

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");

    pdf.text(
      `${equipamento.id} - ${equipamento.nome}`,
      17,
      y + 2
    );

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    pdf.text(
      `Local: ${equipamento.local}`,
      17,
      y + 9
    );

    pdf.text(
      `Temperatura: ${equipamento.temperatura} °C`,
      17,
      y + 16
    );

    pdf.text(
      `Umidade: ${equipamento.umidade}%`,
      75,
      y + 16
    );

    pdf.text(
      `Inclinação: ${equipamento.inclinacao}°`,
      125,
      y + 16
    );

    pdf.text(
      `Velocidade: ${equipamento.velocidade} km/h`,
      17,
      y + 23
    );

    pdf.text(
      `Risco: ${equipamento.risco}`,
      75,
      y + 23
    );

    pdf.text(
      equipamento.alerta,
      17,
      y + 31
    );

    y += 50;
  });

  /* OCORRÊNCIAS */

  if (ocorrencias.length > 0) {

    if (y > 230) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Ocorrências registradas", 15, y);

    y += 10;

    ocorrencias.forEach((ocorrencia) => {

      if (y > 260) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");

      pdf.text(
        ocorrencia.tipo,
        15,
        y
      );

      y += 6;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");

      pdf.text(
        `Descrição: ${ocorrencia.descricao}`,
        15,
        y
      );

      y += 6;

      pdf.text(
        `Localização: ${ocorrencia.latitude.toFixed(6)}, ${ocorrencia.longitude.toFixed(6)}`,
        15,
        y
      );

      y += 6;

      pdf.text(
        `Data: ${ocorrencia.data}`,
        15,
        y
      );

      y += 12;

      pdf.setDrawColor(220, 220, 220);
      pdf.line(15, y, 195, y);

      y += 8;
    });
  }

  /* CONCLUSÃO */

  if (y > 245) {
    pdf.addPage();
    y = 20;
  }

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Conclusão", 15, y);

  y += 9;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");

  const conclusao =
    "Este relatório apresenta o panorama geral do monitoramento agrícola, " +
    "incluindo equipamentos, sensores, níveis de risco, alertas e " +
    "ocorrências registradas durante a operação.";

  const linhas = pdf.splitTextToSize(
    conclusao,
    180
  );

  pdf.text(linhas, 15, y);

  /* RODAPÉ */

  const paginas = pdf.getNumberOfPages();

  for (let pagina = 1; pagina <= paginas; pagina++) {

    pdf.setPage(pagina);

    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);

    pdf.text(
      "Sompo Seguros • Monitoramento Agrícola",
      15,
      288
    );

    pdf.text(
      `Página ${pagina} de ${paginas}`,
      170,
      288
    );
  }

  pdf.save(
    `relatorio-monitoramento-sompo-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`
  );
}