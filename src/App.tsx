import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  ShieldCheck, AlertTriangle, Info, TrendingUp, 
  TrendingDown, Minus, LayoutDashboard, Table as TableIcon, 
  BarChart3, Settings, ChevronRight, Plane, Search, X,
  Download, FileText, FileSpreadsheet
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReportesPeligros from './components/ReportesPeligros';
import { LOGO_URL, getLogoBase64 } from './utils/logo';

/** Utility for tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Data Definition ---

const MONTHS = [
  'Abr 25', 'May 25', 'Jun 25', 
  'Jul 25', 'Ago 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dic 25', 
  'Ene 26', 'Feb 26', 'Mar 26', 'Abr 26', 'May 26', 'Jun 26', 'Jul 26', 'Ago 26', 'Sep 26', 'Oct 26'
];

interface Indicator {
  id: number;
  objective: string;
  description: string;
  thresholds: {
    acceptable: string;
    tolerable: string;
    intolerable: string;
    // Numerical logic for status calculation
    type: 'higher-is-better' | 'lower-is-better';
    limits: [number, number]; // [Acceptable limit, Tolerable limit]
  };
  values: number[];
  unit: string;
}

const indicators: Indicator[] = [
  {
    id: 1,
    objective: "Reducir la tasa de ocurrencia de incidentes",
    description: "Tasa de incidentes por cada 2000 vuelos",
    thresholds: {
      acceptable: "0 incidentes",
      tolerable: "1 incidente",
      intolerable: "Mas de 2 incidentes",
      type: 'lower-is-better',
      limits: [0, 1]
    },
    values: [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    unit: "inc"
  },
  {
    id: 2,
    objective: "Mantener cero accidentes",
    description: "Accidente en las operaciones",
    thresholds: {
      acceptable: "0 accidentes",
      tolerable: "N/A",
      intolerable: "Ocurrencia de un accidente",
      type: 'lower-is-better',
      limits: [0, 0]
    },
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    unit: "acc"
  },
  {
    id: 3,
    objective: "Gestionar peligros identificados",
    description: "Reportes de peligros resueltos Anual",
    thresholds: {
      acceptable: ">= 97%",
      tolerable: "85% - 96%",
      intolerable: "<= 84%",
      type: 'higher-is-better',
      limits: [97, 85]
    },
    values: [81, 78, 77, 76, 75, 75, 73, 75, 77, 75, 75, 77, 75, 75, 75, 75, 77, 75, 72],
    unit: "%"
  },
  {
    id: 4,
    objective: "Capacitación SMS",
    description: "Personal con curso SMS actualizado",
    thresholds: {
      acceptable: ">= 98%",
      tolerable: ">= 90%",
      intolerable: "< 90%",
      type: 'higher-is-better',
      limits: [98, 90]
    },
    values: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 80, 79, 92.5],
    unit: "%"
  },
  {
    id: 5,
    objective: "Capacitación PRE",
    description: "Personal con curso PRE actualizado",
    thresholds: {
      acceptable: ">= 98%",
      tolerable: ">= 90%",
      intolerable: "< 90%",
      type: 'higher-is-better',
      limits: [98, 90]
    },
    values: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 80, 79, 92.5],
    unit: "%"
  },
  {
    id: 6,
    objective: "Briefing de seguridad",
    description: "Herramienta de aprendizaje continuo",
    thresholds: {
      acceptable: ">= 100",
      tolerable: ">= 80",
      intolerable: "< 80",
      type: 'higher-is-better',
      limits: [100, 80]
    },
    values: [102, 98, 125, 112, 75, 142, 148, 135, 104, 116, 122, 117, 125, 122, 96, 63, 62, 36, 65],
    unit: "qty"
  },
  {
    id: 7,
    objective: "Jornadas de FOD",
    description: "Recolección de partículas FOD mensuales",
    thresholds: {
      acceptable: ">= 120",
      tolerable: ">= 80",
      intolerable: "< 80",
      type: 'higher-is-better',
      limits: [120, 80]
    },
    values: [167, 112, 177, 97, 216, 175, 245, 239, 177, 147, 154, 139, 115, 115, 102, 17, 72, 107, 115],
    unit: "qty"
  },
  {
    id: 8,
    objective: "Capacidad de Personal",
    description: "Mínimo de personal para operaciones",
    thresholds: {
      acceptable: ">= 85%",
      tolerable: ">= 70%",
      intolerable: "< 70%",
      type: 'higher-is-better',
      limits: [85, 70]
    },
    values: [65, 75, 75, 75, 73, 72, 75, 75, 74, 74, 85, 74, 75, 74, 75, 75, 70, 72, 85],
    unit: "%"
  },
  {
    id: 9,
    objective: "Capacidad de EAT",
    description: "Mínimo de EAT para operaciones",
    thresholds: {
      acceptable: ">= 75%",
      tolerable: ">= 65%",
      intolerable: "< 65%",
      type: 'higher-is-better',
      limits: [75, 65]
    },
    values: [55, 56, 55, 55, 55, 55, 58, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55],
    unit: "%"
  },
  {
    id: 10,
    objective: "Reducción de errores",
    description: "Incumplimientos de procedimientos",
    thresholds: {
      acceptable: "< 10",
      tolerable: "10 - 15",
      intolerable: "> 15",
      type: 'lower-is-better',
      limits: [10, 15]
    },
    values: [18, 19, 15, 18, 21, 17, 18, 17, 15, 18, 20, 17, 16, 14, 12, 0, 0, 15, 16],
    unit: "qty"
  },
  {
    id: 11,
    objective: "Reducción fallas EAT",
    description: "1 falla cada X servicios",
    thresholds: {
      acceptable: ">= 20",
      tolerable: ">= 15",
      intolerable: "< 15",
      type: 'higher-is-better',
      limits: [20, 15]
    },
    values: [20.24, 16, 13, 18, 12, 16, 13.23, 15.6, 25.62, 14.9, 17.88, 13.65, 11.94, 17.58, 15.41, 0, 0, 36.6, 22.62],
    unit: "ratio"
  },
  {
    id: 12,
    objective: "Percepción SMS",
    description: "Valoración del personal (1-5)",
    thresholds: {
      acceptable: "> 4.5",
      tolerable: "> 4.0",
      intolerable: "< 4.0",
      type: 'higher-is-better',
      limits: [4.5, 4.0]
    },
    values: [4.65, 4.6, 4.59, 4.66, 4.61, 4.62, 4.68, 4.66, 4.73, 4.56, 4.69, 4.69, 4.59, 4.66, 4.6, 4.64, 4.56, 4.53, 4.56],
    unit: "pts"
  },
  {
    id: 13,
    objective: "Aprendizaje SMS",
    description: "Promedio conocimientos (0-20)",
    thresholds: {
      acceptable: ">= 18",
      tolerable: ">= 16",
      intolerable: "< 16",
      type: 'higher-is-better',
      limits: [18, 16]
    },
    values: [17.03, 17.44, 18.16, 17.74, 17.46, 17.59, 17.61, 18, 18.6, 16.14, 17.3, 17.23, 17.31, 17.67, 17.2, 18.03, 17.43, 17.98, 18.61],
    unit: "pts"
  }
];

// --- Components ---

const StatusBadge = ({ value, thresholds }: { value: number, thresholds: Indicator['thresholds'] }) => {
  const { type, limits } = thresholds;
  let status: 'acceptable' | 'tolerable' | 'intolerable' = 'acceptable';

  if (type === 'higher-is-better') {
    if (value >= limits[0]) status = 'acceptable';
    else if (value >= limits[1]) status = 'tolerable';
    else status = 'intolerable';
  } else {
    if (value <= limits[0]) status = 'acceptable';
    else if (value <= limits[1]) status = 'tolerable';
    else status = 'intolerable';
  }

  const styles = {
    acceptable: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    tolerable: "bg-slate-400/10 text-slate-500 border-slate-400/20",
    intolerable: "bg-slate-900/10 text-slate-900 border-slate-900/20"
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", styles[status])}>
      {status}
    </span>
  );
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'data' | 'reports'>('overview');
  const [selectedIndicator, setSelectedIndicator] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Download Trend Analysis Report as PDF with custom charts and interpretations
  const handleDownloadTrendsPDF = async () => {
    setIsGeneratingPdf(true);
    const logoBase64 = await getLogoBase64();
    
    setTimeout(() => {
      try {
        // 1. Filter indicators based on the search/dropdown selection
        const filteredInds = indicators.filter(ind => 
          !searchTerm || ind.objective === searchTerm
        );

        // Create jsPDF instance
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width; // 210mm
        const pageHeight = doc.internal.pageSize.height; // 297mm

        // Header banner colors: Slate Blue (#0f172a)
        const drawHeaderBanner = () => {
          doc.setFillColor(15, 23, 42); // slate-900
          doc.rect(14, 12, pageWidth - 28, 26, 'F');

          doc.setTextColor(255, 255, 255);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(13);
          doc.text("AEROSERVICIOS GLECO 904, C.A.", 20, 20);

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(186, 230, 253); // sky-200
          doc.text("SISTEMA DE GESTIÓN DE LA SEGURIDAD OPERACIONAL (SMS)", 20, 26);
          doc.setFont("Helvetica", "bold");
          doc.text("REPORTE EJECUTIVO DE ANÁLISIS COMPARATIVO DE TENDENCIAS", 20, 32);

          // Add company logo in white rounded container on top right of the banner
          if (logoBase64) {
            try {
              doc.setFillColor(255, 255, 255);
              doc.roundedRect(pageWidth - 14 - 36, 14, 32, 22, 2, 2, 'F');
              doc.addImage(logoBase64, 'PNG', pageWidth - 14 - 34, 15, 28, 20);
            } catch (e) {
              console.warn("Could not draw logo in PDF:", e);
            }
          }
        };

        // Draw header and details
        drawHeaderBanner();

        doc.setTextColor(15, 23, 42); // slate 900
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text("METADATOS DEL DOCUMENTO", 14, 46);
        
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.4);
        doc.line(14, 48, pageWidth - 14, 48);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 53);
        doc.text("Preparado por: Jefatura de Gestión de la Seguridad Operacional", 14, 58);
        doc.text("Rango Analizado:", 14, 63);
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        const rangeText = monthFilter === 'all' ? `Abril 2025 - Octubre 2026 (Completo)` :
                          monthFilter === 'last3' ? "Últimos 3 Meses" :
                          monthFilter === 'last6' ? "Últimos 6 Meses" :
                          `Desde el inicio hasta ${MONTHS[parseInt(monthFilter)] || ''}`;
        doc.text(rangeText, 39, 63);

        doc.setTextColor(71, 85, 105);
        doc.setFont("Helvetica", "normal");
        doc.text("Indicadores Incluidos:", 115, 53);
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(searchTerm ? `Profundización: ${searchTerm.substring(0, 32)}...` : "Todos los Indicadores Clave SMS (13)", 147, 53);

        doc.setTextColor(71, 85, 105);
        doc.setFont("Helvetica", "normal");
        doc.text("Evaluación del Periodo:", 115, 58);
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(3, 105, 161); // sky-700
        doc.text("TENDENCIAS OPERATIVAS BAJO CONTROL", 147, 58);

        doc.setTextColor(71, 85, 105);
        doc.setFont("Helvetica", "normal");
        doc.text("Firma de Aprobación:", 115, 63);
        doc.setFont("Helvetica", "bold");
        doc.text("Dirección de Seguridad SMS", 147, 63);

        // Quick horizontal separator
        doc.line(14, 67, pageWidth - 14, 67);

        // Interpretations catalog based on each indicator's ID
        const getInterpretation = (id: number, currentVal: number, avgVal: number): string => {
          const diffStr = currentVal > avgVal ? "superior al promedio" : currentVal < avgVal ? "inferior al promedio" : "alineado con el promedio";
          
          switch (id) {
            case 1:
              return `Tasa actual de ${currentVal} ${currentVal === 1 ? 'incidente' : 'incidentes'} por cada 2000 vuelos, cifra que es ${diffStr} histórico (${avgVal.toFixed(1)}). El estado es óptimo/aceptable; se mantiene estricta vigilancia en horas pico de Maiquetía y Porlamar para evitar desvíos con EAT.`;
            case 2:
              return `Indicador crítico de accidentes en cero (0). Mantiene un desempeño óptimo y cumple con el principal objetivo estratégico del SMS. Se aconseja continuar con los briefings de prevención antes de cada jornada operativa.`;
            case 3:
              return `La tasa de resolución del ${currentVal}% se encuentra por debajo del estándar aceptable (>=97%). Se denota un retraso promedio en el cierre de reportes de mantenimiento correctivo de EAT. Se exhorta a los jefes de talleres de rampa a priorizar estas mitigaciones pendientes.`;
            case 4:
              return `Cumplimiento académico del ${currentVal}%, ${currentVal >= 98 ? 'certificando una alta concientización del personal operativo' : currentVal >= 90 ? 'en nivel tolerable' : 'por debajo del estándar mínimo (90%)'}. Se deben programar jornadas de refrescamiento SMS para el personal pendiente.`;
            case 5:
              return `Alineación en Plan de Respuesta a Emergencias (PRE) del ${currentVal}%, ${currentVal >= 98 ? 'certificación óptima' : currentVal >= 90 ? 'en nivel tolerable' : 'por debajo del estándar requerido (90%)'}. Coordinar recertificaciones con jefatura técnica.`;
            case 6:
              return `Se registraron ${currentVal} briefings de seguridad, ${currentVal >= 100 ? 'superando la meta de 100' : 'por debajo de la meta de 100'}. Los briefings diarios actúan como una barrera proactiva sumamente efectiva, refrescando procedimientos críticos y mitigando desvíos rutinarios.`;
            case 7:
              return `Recolección mensual de ${currentVal} elementos extraños (FOD), un volumen ${diffStr} histórico (${avgVal.toFixed(1)}). El FOD representa una amenaza directa para los motores de las aeronaves; se recomienda intensificar las inspecciones en plataformas de embarque.`;
            case 8:
              return `La disponibilidad de personal técnico calificado es del ${currentVal}%, situándose por debajo del límite aceptable (85%) pero por encima del límite mínimo tolerable (70%). Se clasifica con estado tolerable, aunque se aconseja coordinar planes de contingencia horaria con la Gerencia de Operaciones para evitar fatiga operativa del equipo activo.`;
            case 9:
              return `La operatividad física de los Equipos de Apoyo en Tierra (EAT) se ubica en un nivel muy deficiente del ${currentVal}%, lejos del umbral aceptable (75%). La falta de disponibilidad en tractores de remolque afecta los tiempos de giro y eleva los riesgos de daños por rampa. Plan de mantenimiento correctivo de emergencia inmediato es crítico.`;
            case 10:
              return `Se contabilizaron ${currentVal} desvíos de procedimientos operativos estándar. Aunque es una cifra menor en comparación con meses previos, es crucial mantener auditorías aleatorias y retroalimentación en sitio para erradicar el exceso de confianza de los operarios.`;
            case 11:
              return `El ratio de confiabilidad es de ${currentVal} servicios por cada falla reportada de EAT. Esta tendencia es ${diffStr} de la media (${avgVal.toFixed(1)}). Sugiere que la implementación de listas de chequeo pre-operacionales de los equipos está teniendo un impacto favorable en la prevención.`;
            case 12:
              return `Puntaje extraordinario de percepción del clima de seguridad: ${currentVal} / 5 puntos. Los trabajadores perciben que los canales de comunicación de peligros son confiables, transparentes y libres de punitividad, lo que refuerza de forma positiva la cultura de reporte.`;
            case 13:
              return `Promedio de conocimientos técnicos en SMS evaluado en ${currentVal} sobre 20. El resultado es tolerable pero perfectible. Se sugiere incentivar el estudio continuo mediante breves cuestionarios interactivos en los terminales de firma diaria.`;
            default:
              return `El indicador de ${currentVal} presenta un comportamiento ${diffStr} histórico de ${avgVal.toFixed(2)}. Monitoreo constante bajo las directrices del programa de control de seguridad SMS de GLECO 904.`;
          }
        };

        // Helper to calculate status of indicator values
        const getStatusTextAndColor = (val: number, thresholds: Indicator['thresholds']): { text: string, rgb: [number, number, number] } => {
          const { type, limits } = thresholds;
          if (type === 'higher-is-better') {
            if (val >= limits[0]) return { text: "ACEPTABLE", rgb: [16, 185, 129] }; // emerald
            if (val >= limits[1]) return { text: "TOLERABLE", rgb: [100, 116, 139] }; // slate-500
            return { text: "INTOLERABLE", rgb: [220, 38, 38] }; // red
          } else {
            if (val <= limits[0]) return { text: "ACEPTABLE", rgb: [16, 185, 129] };
            if (val <= limits[1]) return { text: "TOLERABLE", rgb: [100, 116, 139] };
            return { text: "INTOLERABLE", rgb: [220, 38, 38] };
          }
        };

        // Y coordinate start for content
        let y = 72;

        // Draw indicators
        filteredInds.forEach((ind, index) => {
          // Get the timeline values and months for this specific indicator
          const values = chartData.map(d => d[`ind_${ind.id}`] as number);
          const months = chartData.map(d => d.month as string);
          
          const currentVal = values[values.length - 1] ?? 0;
          const sum = values.reduce((acc, curr) => acc + curr, 0);
          const avgVal = sum / (values.length || 1);
          const statusObj = getStatusTextAndColor(currentVal, ind.thresholds);

          // Check if we need a new page
          // Each indicator card takes about 45mm of vertical space
          if (y > pageHeight - 55) {
            doc.addPage();
            drawHeaderBanner();
            y = 48; // reset content Y on new page
          }

          // --- Draw Indicator Block ---
          // Background Box for the indicator block
          doc.setFillColor(248, 250, 252); // slate-50
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.roundedRect(14, y, pageWidth - 28, 40, 2.5, 2.5, 'FD');

          // 1. Text header of the Indicator
          doc.setTextColor(15, 23, 42); // slate-900
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`${index + 1}. ${ind.objective}`, 18, y + 6);

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139); // slate-500
          doc.text(`Definición: ${ind.description}  |  Unidad: ${ind.unit}`, 18, y + 10.5);

          // 2. Metrics Block on the Left (x: 18)
          doc.setTextColor(71, 85, 105);
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7.5);
          doc.text("Valor Actual:", 18, y + 18);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(`${currentVal} ${ind.unit}`, 18, y + 22);

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(71, 85, 105);
          doc.text("Promedio Histórico:", 18, y + 28);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
          doc.text(`${avgVal.toFixed(2)}`, 18, y + 32);

          // Status Badge
          doc.setFillColor(statusObj.rgb[0], statusObj.rgb[1], statusObj.rgb[2]);
          doc.roundedRect(18, y + 34.5, 22, 3.8, 1, 1, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(6.5);
          doc.text(statusObj.text, 29, y + 37.3, { align: 'center' });

          // 3. Mini Trend Vector Line Chart in the Center-Right (x: 54 to 104 - width: 50mm)
          const chartXStart = 54;
          const chartWidth = 50;
          const chartHeight = 22;
          const chartYBottom = y + 34;

          // Draw mini chart grid box
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(241, 245, 249);
          doc.rect(chartXStart, y + 12, chartWidth, chartHeight, 'FD');

          // Draw light horizontal grids
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.2);
          doc.line(chartXStart, y + 12 + (chartHeight / 3), chartXStart + chartWidth, y + 12 + (chartHeight / 3));
          doc.line(chartXStart, y + 12 + (chartHeight * 2 / 3), chartXStart + chartWidth, y + 12 + (chartHeight * 2 / 3));

          // Draw trendline
          const minVal = Math.min(...values);
          const maxVal = Math.max(...values);
          const valRange = (maxVal - minVal) || 1;

          // Draw the vector lines connecting data points
          doc.setDrawColor(37, 99, 235); // blue-600
          doc.setLineWidth(0.4);

          let prevPX = 0;
          let prevPY = 0;

          values.forEach((v, idx) => {
            const pctX = idx / (values.length - 1 || 1);
            const pctY = (v - minVal) / valRange;

            const pX = chartXStart + (pctX * chartWidth);
            const pY = chartYBottom - (pctY * chartHeight);

            if (idx > 0) {
              doc.line(prevPX, prevPY, pX, pY);
            }

            // Keep last point coordinates to draw a colored status circle
            prevPX = pX;
            prevPY = pY;
          });

          // Draw a small circle dot at the final point
          doc.setFillColor(statusObj.rgb[0], statusObj.rgb[1], statusObj.rgb[2]);
          doc.circle(prevPX, prevPY, 0.8, 'F');

          // Month labels under mini chart
          doc.setTextColor(148, 163, 184); // slate-400
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(6);
          doc.text(months[0] || '', chartXStart, y + 36.5);
          doc.text(months[months.length - 1] || '', chartXStart + chartWidth, y + 36.5, { align: 'right' });

          // 4. Written Interpretation Area on the Right (x: 110 to 192 - width: 82mm)
          doc.setTextColor(15, 23, 42); // slate-900
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(7.5);
          doc.text("Interpretación de Seguridad (SMS):", 110, y + 15);

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(51, 65, 85); // slate-700
          const interpretationText = getInterpretation(ind.id, currentVal, avgVal);
          doc.text(interpretationText, 110, y + 19.5, { maxWidth: pageWidth - 14 - 110, lineHeightFactor: 1.35 });

          // Increment y for the next block
          y += 44;
        });

        // Write concluding block if we have space, or add new page
        if (y > pageHeight - 40) {
          doc.addPage();
          drawHeaderBanner();
          y = 48;
        }

        // --- Footer signatures and validation ---
        doc.setFillColor(15, 23, 42);
        doc.rect(14, y, pageWidth - 28, 0.6, 'F');

        y += 6;
        doc.setTextColor(15, 23, 42);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("DECLARACIÓN DE COMPROMISO Y CONFIDENCIALIDAD DE LA INFORMACIÓN:", 14, y);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text("La información contenida en este reporte de tendencias es confidencial y de uso exclusivo de los departamentos autorizados para mitigar desviaciones operacionales de Aeroservicios Gleco 904. Se rige por las directrices de seguridad operacional de la AAC y políticas internas no punitivas.", 14, y + 4, { maxWidth: pageWidth - 28, lineHeightFactor: 1.25 });

        y += 18;
        // Signatures mockup
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.line(30, y, 85, y);
        doc.line(pageWidth - 85, y, pageWidth - 30, y);

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Jefe de Gestión SMS", 57.5, y + 4, { align: 'center' });
        doc.text("Ejecutivo Responsable del SMS", pageWidth - 57.5, y + 4, { align: 'center' });

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Aeroservicios Gleco 904, C.A.", 57.5, y + 7, { align: 'center' });
        doc.text("Aeroservicios Gleco 904, C.A.", pageWidth - 57.5, y + 7, { align: 'center' });

        // --- Add footer / page numbers dynamically on all pages ---
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.4);
          doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);
          
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139); // slate-500
          doc.text("Aeroservicios Gleco 904, C.A.  |  Control de Tendencias SMS 2025-2026", 14, pageHeight - 7);
          doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
        }

        doc.save(`SMS_Tendencias_Gleco_904_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (error) {
        console.error("Error generating trends PDF: ", error);
        alert("Ocurrió un error al generar el PDF de tendencias. Por favor intente de nuevo.");
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 1200);
  };

  // Download Raw Indicators Data as CSV (Excel compatible with UTF-8 BOM)
  const handleDownloadIndicatorsCSV = () => {
    const escapeCSV = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const headers = ['ID', 'Objetivo / Indicador SMS', 'Unidad de Medida', ...MONTHS];
    const headerLine = headers.map(escapeCSV).join(',');
    const rows = indicators.map(ind => [
      escapeCSV(ind.id),
      escapeCSV(ind.objective),
      escapeCSV(ind.unit),
      ...ind.values.map(escapeCSV)
    ].join(',')).join('\r\n');

    const csvContent = '\uFEFF' + headerLine + '\r\n' + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SMS_Indicadores_Datos_Crudos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const chartData = useMemo(() => {
    const allData = MONTHS.map((month, idx) => {
      const dataPoint: any = { month };
      indicators.forEach(ind => {
        dataPoint[`ind_${ind.id}`] = ind.values[idx] || 0;
      });
      return dataPoint;
    });

    if (monthFilter === 'all') return allData;
    if (monthFilter === 'last3') return allData.slice(-3);
    if (monthFilter === 'last6') return allData.slice(-6);
    
    const monthIndex = parseInt(monthFilter);
    if (!isNaN(monthIndex)) {
      // If a single month is selected, we show a small range around it or just that month
      // To keep it as a "trend", maybe show from start up to that month?
      // User said "filtrar un lapso o un mes". 
      // Let's show from the beginning up to the selected month.
      return allData.slice(0, monthIndex + 1);
    }

    return allData;
  }, [monthFilter]);

  const currentIndicator = indicators.find(i => i.id === selectedIndicator)!;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30">
      {/* Sidebar / Navigation */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-50 hidden lg:flex flex-col">
        <div className="p-5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-50 border border-slate-200/80 rounded-xl shadow-xs">
              <img 
                src={LOGO_URL} 
                alt="Logo ASG Gleco 904" 
                className="h-10 w-auto object-contain"
              />
            </div>
            <div>
              <h1 className="font-black text-base tracking-tight text-blue-950 leading-none">GLECO 904</h1>
              <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider mt-1">Aeroservicios C.A.</p>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Safety Management System
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('overview')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === 'overview' ? "bg-blue-700 text-white shadow-lg shadow-blue-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('trends')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === 'trends' ? "bg-blue-700 text-white shadow-lg shadow-blue-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <BarChart3 size={18} />
            Tendencias
          </button>
          <button 
            onClick={() => setActiveTab('data')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === 'data' ? "bg-blue-700 text-white shadow-lg shadow-blue-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <TableIcon size={18} />
            Base de Datos
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === 'reports' ? "bg-blue-700 text-white shadow-lg shadow-blue-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <ShieldCheck size={18} />
            Reportes de Peligros
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Estado del Sistema</p>
            <div className="flex items-center gap-2 text-blue-600">
              <ShieldCheck size={14} />
              <span className="text-xs font-semibold">Operación Monitoreada</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-blue-950 border-b border-blue-900 z-40 px-6 sm:px-8 py-4 sm:py-5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="bg-white rounded-2xl p-2 sm:p-2.5 shadow-md border border-white/20 shrink-0 flex items-center justify-center">
              <img 
                src={LOGO_URL} 
                alt="Aeroservicios Gleco 904 Logo" 
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </div>
            <div>
              <div className="mb-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-tight tracking-tight">KPI-SMS-Aeroservicios Gleco 904.C.A</h1>
                <p className="text-xs sm:text-sm font-bold text-blue-400 uppercase tracking-widest">Jefatura de Gestión de la Seguridad Operacional</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-blue-300/80 uppercase tracking-widest bg-blue-900/80 px-2 py-0.5 rounded">
                  {activeTab === 'overview' ? 'Vista General' : activeTab === 'trends' ? 'Análisis de Tendencias' : activeTab === 'data' ? 'Datos Crudos' : 'Reportes de Peligros'}
                </span>
                <span className="text-xs font-semibold text-white/80 hidden sm:inline">Tablero de Indicadores 2025-2026</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-blue-300/50 uppercase">Última Actualización</p>
              <p className="text-sm font-semibold text-white">31 Oct 2026</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-900/50 border border-blue-800 flex items-center justify-center hover:bg-blue-800 transition-colors cursor-pointer">
              <Settings size={18} className="text-blue-200" />
            </div>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'overview' && (
            <div className="space-y-8 bg-blue-100/70 -m-8 p-8 min-h-[calc(100vh-120px)]">
              {/* Reporting Month Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Resultados del Mes</h3>
                  <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">Periodo: {MONTHS[MONTHS.length - 1]}</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Datos Consolidados</span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {indicators.map(ind => (
                  <div key={ind.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => { setSelectedIndicator(ind.id); setActiveTab('trends'); }}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-700 group-hover:text-white transition-colors">
                        <Info size={20} />
                      </div>
                      <StatusBadge value={ind.values[ind.values.length - 1]} thresholds={ind.thresholds} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{ind.objective}</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-bold tracking-tight text-slate-800">
                        {ind.values[ind.values.length - 1]}
                        <span className="text-sm font-medium text-slate-400 ml-1">{ind.unit}</span>
                      </h3>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-tighter">{ind.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="space-y-8 bg-blue-100/70 -m-8 p-8 min-h-[calc(100vh-120px)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-2xl font-bold text-slate-800">Análisis Comparativo de Tendencias</h3>
                
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <select 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="appearance-none pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full md:w-64 transition-all cursor-pointer text-slate-700 font-medium"
                    >
                      <option value="">Todos los indicadores</option>
                      {indicators.map(ind => (
                        <option key={ind.id} value={ind.objective}>{ind.objective}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight size={14} className="rotate-90" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
                    <TrendingUp size={14} className="text-blue-500" />
                    <select 
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="bg-transparent border-none focus:outline-none cursor-pointer text-slate-600 font-bold"
                    >
                      <option value="all">Abr 2025 - Oct 2026 (Todo)</option>
                      <option value="last3">Últimos 3 meses</option>
                      <option value="last6">Últimos 6 meses</option>
                      <optgroup label="Hasta el mes:">
                        {MONTHS.map((m, i) => (
                           <option key={i} value={i}>{m}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>

              {/* Recuadro de Descarga de Informe PDF de Tendencias */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-950 rounded-3xl p-6 text-white border border-blue-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-300">
                    <TrendingUp size={18} className="text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Módulo de Exportación de Tendencias (SMS)</span>
                  </div>
                  <h4 className="text-lg font-bold">Generación de Informe de Tendencias PDF con Vectores e Interpretación</h4>
                  <p className="text-xs text-blue-200/80 max-w-2xl">
                    Este sistema compila todos los indicadores de tendencia en base a los filtros configurados arriba ({searchTerm ? `Profundización en: ${searchTerm}` : "Todos los indicadores"}). Genera gráficos de vectores de tendencia calibrados, promedios de desempeño y sus correspondientes análisis de seguridad operacional para compartir con la Gerencia de Operaciones, Talleres, Servicios de Rampa e Ingeniería.
                  </p>
                </div>
                <button
                  onClick={handleDownloadTrendsPDF}
                  disabled={isGeneratingPdf}
                  className={cn(
                    "flex items-center gap-2 text-white font-bold text-xs px-6 py-4 rounded-2xl transition-all shadow-lg active:scale-95 shrink-0 cursor-pointer",
                    isGeneratingPdf 
                      ? "bg-emerald-700 opacity-85 cursor-not-allowed shadow-none" 
                      : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-950/20"
                  )}
                >
                  {isGeneratingPdf ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Descargar Informe PDF de Tendencias
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {indicators
                  .filter(ind => 
                    !searchTerm || ind.objective === searchTerm
                  )
                  .map(ind => {
                    const lastDataPoint = chartData[chartData.length - 1];
                    const currentValue = lastDataPoint ? lastDataPoint[`ind_${ind.id}`] : 0;
                    
                    return (
                      <div key={ind.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="max-w-[70%]">
                            <h4 className="text-sm font-bold leading-tight group-hover:text-blue-700 transition-colors text-slate-700">{ind.objective}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{ind.unit}</p>
                          </div>
                          <StatusBadge value={currentValue} thresholds={ind.thresholds} />
                        </div>
                        
                        <div className="h-48 w-full mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis 
                            dataKey="month" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 8, fill: '#94A3B8', fontWeight: 'bold' }}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            hide={true}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '12px', 
                              border: 'none', 
                              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey={`ind_${ind.id}`} 
                            stroke="#2563EB" 
                            strokeWidth={3} 
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Actual</span>
                        <span className="text-sm font-bold text-slate-700">{currentValue}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Promedio</span>
                        <span className="text-sm font-bold text-slate-500">
                          {(chartData.reduce((acc, curr) => acc + curr[`ind_${ind.id}`], 0) / chartData.length).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6 bg-blue-100/70 -m-8 p-8 min-h-[calc(100vh-120px)]">
              {/* Header card with raw data download action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <TableIcon className="text-blue-700" size={22} />
                    Matriz de Datos Crudos de Indicadores SMS
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    Registros mensuales consolidados de todos los objetivos de seguridad operacional
                  </p>
                </div>
                <button
                  onClick={handleDownloadIndicatorsCSV}
                  title="Descargar matriz de datos crudos en formato CSV para Excel"
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md shadow-slate-300 cursor-pointer shrink-0"
                >
                  <FileSpreadsheet size={16} className="text-emerald-400" />
                  Descargar Datos Crudos (CSV)
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-10">Indicador</th>
                      {MONTHS.map(m => (
                        <th key={m} className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px]">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.map(ind => (
                      <tr key={ind.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 sticky left-0 bg-white z-10 border-r border-slate-100">
                          <p className="text-xs font-bold whitespace-nowrap text-slate-700">{ind.objective}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{ind.unit}</p>
                        </td>
                        {ind.values.map((val, i) => (
                          <td key={i} className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-mono font-medium text-slate-600">{val}</span>
                              <StatusBadge value={val} thresholds={ind.thresholds} />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {activeTab === 'reports' && (
            <ReportesPeligros />
          )}
        </div>
      </main>

      {/* Mobile Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-6 py-4 flex justify-around z-50">
        <button onClick={() => setActiveTab('overview')} className={cn("p-2", activeTab === 'overview' ? "text-blue-700" : "text-slate-400")}>
          <LayoutDashboard size={24} />
        </button>
        <button onClick={() => setActiveTab('trends')} className={cn("p-2", activeTab === 'trends' ? "text-blue-700" : "text-slate-400")}>
          <BarChart3 size={24} />
        </button>
        <button onClick={() => setActiveTab('data')} className={cn("p-2", activeTab === 'data' ? "text-blue-700" : "text-slate-400")}>
          <TableIcon size={24} />
        </button>
        <button onClick={() => setActiveTab('reports')} className={cn("p-2", activeTab === 'reports' ? "text-blue-700" : "text-slate-400")}>
          <ShieldCheck size={24} />
        </button>
      </div>
    </div>
  );
}
