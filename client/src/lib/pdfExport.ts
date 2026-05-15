// PDF export du rapport d'analyse via jsPDF + jspdf-autotable + html2canvas
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import {
  capacityLabel,
  type WodAnalysis,
  type Capacity,
} from "./wodAnalyzer";
import { computeRecovery } from "./recovery";

const ORANGE: [number, number, number] = [255, 107, 53];
const CYAN: [number, number, number] = [34, 211, 238];
const CHARCOAL: [number, number, number] = [15, 17, 21];
const MUTED: [number, number, number] = [120, 130, 145];

const FILIERE_KEY = ["atp_pcr", "glycolytic", "oxidative"] as const;
const FILIERE_LABEL = {
  atp_pcr: "ATP-PCr (phosphagène)",
  glycolytic: "Glycolytique anaérobie",
  oxidative: "Oxydative (aérobie)",
};

const CAPS: Capacity[] = [
  "force_max",
  "puissance",
  "endurance_force",
  "vo2max",
  "lactique",
  "gainage",
  "skill",
];

function dateLabel(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export interface PdfExportOptions {
  wodName?: string;
  radarElementId?: string; // id de l'élément DOM contenant le radar Recharts
}

/**
 * Génère et télécharge un PDF A4 portrait du rapport d'analyse.
 */
export async function exportAnalysisPdf(
  analysis: WodAnalysis,
  opts: PdfExportOptions = {}
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // ─── En-tête ──────────────────────────────────────────────────────────
  // Logo simple : carré orange + monogramme W
  doc.setFillColor(...ORANGE);
  doc.roundedRect(margin, y, 10, 10, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("W", margin + 5, y + 6.5, { align: "center" });

  doc.setTextColor(...CHARCOAL);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("WOD Analyzer", margin + 14, y + 5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Rapport d'analyse hybride filières × capacités", margin + 14, y + 9.5);

  // Date à droite
  doc.setTextColor(...CHARCOAL);
  doc.setFontSize(9);
  doc.text(dateLabel(), pageW - margin, y + 5, { align: "right" });
  if (opts.wodName) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(opts.wodName, pageW - margin, y + 10, { align: "right" });
  }
  y += 14;

  // ─── Bloc méta ────────────────────────────────────────────────────────
  doc.setDrawColor(220, 224, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  const metas = [
    ["Format", analysis.formatLabel],
    ["Durée estimée", analysis.estimatedDurationLabel],
    ["Intensité", analysis.intensityLabel],
    [
      "Filière dominante",
      `${FILIERE_LABEL[analysis.dominantEnergetic]} (${Math.round(analysis.energetics[analysis.dominantEnergetic])}%)`,
    ],
  ];
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const colW = (pageW - margin * 2) / 2;
  metas.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = margin + col * colW;
    const cy = y + row * 8;
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), cx, cy);
    doc.setTextColor(...CHARCOAL);
    doc.setFont("helvetica", "bold");
    doc.text(value, cx, cy + 4);
    doc.setFont("helvetica", "normal");
  });
  y += 18;

  // ─── WOD source ───────────────────────────────────────────────────────
  doc.setTextColor(...CHARCOAL);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("WOD source", margin, y);
  y += 4;
  doc.setFillColor(245, 246, 248);
  const lines = doc.splitTextToSize(analysis.inputText.trim(), pageW - margin * 2 - 6);
  const blockH = Math.max(10, lines.length * 4 + 6);
  doc.roundedRect(margin, y, pageW - margin * 2, blockH, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("courier", "normal");
  doc.setTextColor(60, 65, 75);
  doc.text(lines, margin + 3, y + 5);
  doc.setFont("helvetica", "normal");
  y += blockH + 6;

  // ─── Radar (capture PNG) ──────────────────────────────────────────────
  if (opts.radarElementId) {
    const el = document.getElementById(opts.radarElementId);
    if (el) {
      try {
        const canvas = await html2canvas(el, {
          backgroundColor: "#1A1D24",
          scale: 2,
          logging: false,
        });
        const img = canvas.toDataURL("image/png");
        const imgW = 100;
        const imgH = (canvas.height / canvas.width) * imgW;
        if (y + imgH > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        const cx = (pageW - imgW) / 2;
        doc.setTextColor(...CHARCOAL);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Radar des 10 capacités", margin, y);
        y += 4;
        doc.addImage(img, "PNG", cx, y, imgW, imgH);
        y += imgH + 6;
      } catch (e) {
        // ignore
      }
    }
  }

  // ─── Tableau filières ─────────────────────────────────────────────────
  if (y > pageH - 70) {
    doc.addPage();
    y = margin;
  }
  autoTable(doc, {
    startY: y,
    head: [["Filière énergétique", "Score", "Visualisation"]],
    body: FILIERE_KEY.map((k) => {
      const v = Math.round(analysis.energetics[k]);
      const bar = "█".repeat(Math.round(v / 5)).padEnd(20, "░");
      return [FILIERE_LABEL[k], `${v}%`, bar];
    }),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: ORANGE, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 20 }, 2: { font: "courier" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── Tableau capacités ────────────────────────────────────────────────
  if (y > pageH - 80) {
    doc.addPage();
    y = margin;
  }
  autoTable(doc, {
    startY: y,
    head: [["Capacité neuromusculaire", "Score", "Visualisation"]],
    body: CAPS.map((c) => {
      const v = Math.round(analysis.capacities[c]);
      const bar = "█".repeat(Math.round(v / 5)).padEnd(20, "░");
      return [capacityLabel(c), `${v}%`, bar];
    }),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: CYAN, textColor: 0, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 20 }, 2: { font: "courier" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── Tableau mouvements ───────────────────────────────────────────────
  if (analysis.movements.length > 0) {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }
    autoTable(doc, {
      startY: y,
      head: [["Mouvement", "Reps", "Charge", "Capacité dominante", "Filière dom."]],
      body: analysis.movements.map((m) => {
        const dom = pickDominantEnergetic(m.movement.energetics);
        return [
          m.movement.name,
          m.distanceM ? `${Math.round(m.distanceM)}m` : `${m.reps}`,
          m.loadKg
            ? `${Math.round(m.loadKg)}kg`
            : m.loadPctRm
            ? `${Math.round(m.loadPctRm * 100)}%RM`
            : "—",
          capacityLabel(m.movement.dominantCapacity),
          dom,
        ];
      }),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.8 },
      headStyles: { fillColor: [60, 65, 75], textColor: 255, fontStyle: "bold" },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─── Synthèse + récupération ──────────────────────────────────────────
  if (y > pageH - 70) {
    doc.addPage();
    y = margin;
  }
  doc.setTextColor(...CHARCOAL);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Synthèse du profil", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const summaryLines = doc.splitTextToSize(analysis.summary, pageW - margin * 2);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 4 + 4;

  const reco = computeRecovery(analysis);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Récupération & suite", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const recoTxt = [
    `Récupération recommandée : ${reco.hoursLabel}`,
    `Avant un stimulus de profil similaire : ${reco.beforeSameFiliere}`,
    "",
    "Complémentarité — séances suggérées :",
    ...reco.complementary.map((c) => `  • ${c}`),
    ...(reco.warnings.length > 0
      ? ["", "Points d'attention :", ...reco.warnings.map((w) => `  • ${w}`)]
      : []),
  ].join("\n");
  const recoLines = doc.splitTextToSize(recoTxt, pageW - margin * 2);
  if (y + recoLines.length * 4 > pageH - margin - 10) {
    doc.addPage();
    y = margin;
  }
  doc.text(recoLines, margin, y);
  y += recoLines.length * 4 + 4;

  // ─── Pied de page sur toutes les pages ───────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      "Généré par WOD Analyzer — Outil pédagogique, ne remplace pas l'avis d'un coach.",
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
    doc.text(`${p} / ${pageCount}`, pageW - margin, pageH - 8, { align: "right" });
  }

  const safeName = (opts.wodName || "wod").replace(/[^\w\-]+/g, "_").toLowerCase();
  doc.save(`wod-analyzer-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function pickDominantEnergetic(e: { atp_pcr: number; glycolytic: number; oxidative: number }) {
  const entries = Object.entries(e) as [keyof typeof e, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0][0];
  return top === "atp_pcr" ? "ATP-PCr" : top === "glycolytic" ? "Glyco" : "Oxydat.";
}

// ─── Export PDF programmation hebdo (A4 paysage) ────────────────────────────
export interface WeekProgramSlot {
  day: string; // "Lundi"…
  target: string; // capacité ciblée
  candidates: { name: string; description: string }[];
}

export async function exportWeekProgramPdf(slots: WeekProgramSlot[], sessionsPerWeek: number) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // En-tête
  doc.setFillColor(...ORANGE);
  doc.roundedRect(margin, margin, 8, 8, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("W", margin + 4, margin + 5.5, { align: "center" });

  doc.setTextColor(...CHARCOAL);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Programmation hebdomadaire", margin + 11, margin + 5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`${sessionsPerWeek} séances · ${dateLabel()}`, margin + 11, margin + 9.5);

  // Grille 7 colonnes (jours)
  const gridY = margin + 16;
  const gridH = pageH - gridY - margin - 8;
  const colW = (pageW - margin * 2) / 7;

  slots.forEach((slot, i) => {
    const x = margin + i * colW;
    // header jour
    doc.setFillColor(245, 246, 248);
    doc.roundedRect(x + 1, gridY, colW - 2, gridH, 2, 2, "F");
    doc.setTextColor(...CHARCOAL);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(slot.day, x + colW / 2, gridY + 6, { align: "center" });

    // Target
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ORANGE);
    const targetLines = doc.splitTextToSize(slot.target, colW - 6);
    doc.text(targetLines, x + colW / 2, gridY + 12, { align: "center" });

    // Candidats
    let cy = gridY + 12 + targetLines.length * 4 + 2;
    doc.setTextColor(...CHARCOAL);
    doc.setFontSize(8);
    slot.candidates.slice(0, 3).forEach((c, idx) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. ${c.name}`, x + 3, cy);
      cy += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      const descLines = doc.splitTextToSize(c.description, colW - 6);
      doc.text(descLines.slice(0, 5), x + 3, cy);
      cy += Math.min(descLines.length, 5) * 3 + 2;
      doc.setTextColor(...CHARCOAL);
      doc.setFontSize(8);
    });
  });

  // Pied de page
  doc.setTextColor(...MUTED);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Généré par WOD Analyzer — Outil pédagogique, ne remplace pas l'avis d'un coach.",
    pageW / 2,
    pageH - 5,
    { align: "center" }
  );

  doc.save(`wod-programmation-${new Date().toISOString().slice(0, 10)}.pdf`);
}
