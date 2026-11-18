import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  generate812Reports, 
  SafetyReport 
} from '../reportsData';
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie
} from 'recharts';
import { 
  Plus, Search, AlertTriangle, CheckCircle, Clock, Plane, Calendar, 
  Building, ShieldCheck, ChevronLeft, ChevronRight, X, Sparkles, Filter, RefreshCw,
  Download, FileText, FileSpreadsheet, FileCode, ChevronDown
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LOGO_URL, getLogoBase64 } from '../utils/logo';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ReportesPeligros() {
  // State for reports, initializing from localStorage or fallback to generated 812
  const [reports, setReports] = useState<SafetyReport[]>(() => {
    const defaultReports = generate812Reports();
    try {
      const saved = localStorage.getItem('sms_hazard_reports');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if there is any ID less than 277 (from the old 985/915 database)
          const hasOldDatabaseIds = parsed.some(r => {
            const num = parseInt(r.id.replace('N-SMS-', ''), 10);
            return !isNaN(num) && num < 277;
          });
          if (!hasOldDatabaseIds) {
            // Check if any default reports (such as newly incorporated reports 1089-1106) are missing
            const existingIds = new Set(parsed.map((r: SafetyReport) => r.id));
            const missing = defaultReports.filter(r => !existingIds.has(r.id));
            if (missing.length > 0) {
              const merged = [...missing, ...parsed].sort((a, b) => {
                const numA = parseInt(a.id.replace('N-SMS-', ''), 10) || 0;
                const numB = parseInt(b.id.replace('N-SMS-', ''), 10) || 0;
                return numB - numA;
              });
              return merged;
            }
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error('Error loading reports from localStorage:', e);
    }
    return defaultReports;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem('sms_hazard_reports', JSON.stringify(reports));
    } catch (e) {
      console.error('Error saving reports to localStorage:', e);
    }
  }, [reports]);

  // Form State for Adding new report
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRawMenuOpen, setIsRawMenuOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-generate next ID based on maximum numeric ID in the current list
  const nextSuggestedId = useMemo(() => {
    let maxNum = 1106;
    reports.forEach(r => {
      const num = parseInt(r.id.replace('N-SMS-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return `N-SMS-${maxNum + 1}`;
  }, [reports]);

  const [newReport, setNewReport] = useState({
    id: '',
    fecha: new Date().toISOString().split('T')[0],
    estacion: 'MIQ',
    peligro: '',
    consecuencia: 'Colisión con las aeronaves y EAT',
    fechaCierre: '',
    estado: 'Abierto' as 'Abierto' | 'Cerrado'
  });

  // Update suggested ID when modal opens or nextSuggestedId changes
  useEffect(() => {
    if (isModalOpen) {
      setNewReport(prev => ({
        ...prev,
        id: nextSuggestedId
      }));
    }
  }, [isModalOpen, nextSuggestedId]);

  // Filter and Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [stationFilter, setStationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [consecuenciaFilter, setConsecuenciaFilter] = useState('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Available Stations derived from reports list
  const stations = useMemo(() => {
    const list = new Set(reports.map(r => r.estacion));
    return Array.from(list).sort();
  }, [reports]);

  // Available Consequences derived from reports list
  const consecuencias = useMemo(() => {
    const list = new Set(reports.map(r => r.consecuencia));
    return Array.from(list).sort();
  }, [reports]);

  // Handle adding new report
  const handleAddReport = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newReport.id.trim()) {
      setFormError('Por favor ingrese el número de reporte.');
      return;
    }

    if (reports.some(r => r.id.toLowerCase() === newReport.id.trim().toLowerCase())) {
      setFormError(`El reporte con ID ${newReport.id} ya existe.`);
      return;
    }

    if (!newReport.fecha) {
      setFormError('Por favor seleccione una fecha.');
      return;
    }

    if (!newReport.peligro.trim()) {
      setFormError('Por favor escriba la descripción del peligro/reporte.');
      return;
    }

    let calculatedDias: number | null = null;
    let finalFechaCierre = '';

    if (newReport.estado === 'Cerrado') {
      const fCierre = newReport.fechaCierre || new Date().toISOString().split('T')[0];
      finalFechaCierre = fCierre;
      
      const start = new Date(newReport.fecha);
      const end = new Date(fCierre);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      calculatedDias = diffDays >= 0 ? diffDays : 0;
    }

    const createdReport: SafetyReport = {
      id: newReport.id.trim(),
      fecha: newReport.fecha,
      estacion: newReport.estacion.toUpperCase(),
      peligro: newReport.peligro.trim(),
      consecuencia: newReport.consecuencia,
      fechaCierre: finalFechaCierre,
      dias: calculatedDias,
      estado: newReport.estado
    };

    setReports(prev => [createdReport, ...prev]);
    setSuccessMessage(`¡Reporte ${createdReport.id} agregado con éxito!`);
    
    // Clear form after delay
    setTimeout(() => {
      setIsModalOpen(false);
      setSuccessMessage('');
      setNewReport({
        id: '',
        fecha: new Date().toISOString().split('T')[0],
        estacion: 'MIQ',
        peligro: '',
        consecuencia: 'Colisión con las aeronaves y EAT',
        fechaCierre: '',
        estado: 'Abierto'
      });
    }, 1500);
  };

  // Reset data back to default 830 reports
  const handleResetData = () => {
    if (window.confirm('¿Está seguro de que desea reiniciar la base de datos a los 830 reportes originales (desde el 277 hasta el 1106)? Se perderán los reportes nuevos agregados manualmente.')) {
      setReports(generate812Reports());
    }
  };

  // Download executive summary report for other departments
  const handleDownloadReport = async () => {
    const logoBase64 = await getLogoBase64();

    // 1. Calculate station statistics
    const stationCounts: { [key: string]: number } = {};
    reports.forEach(r => {
      stationCounts[r.estacion] = (stationCounts[r.estacion] || 0) + 1;
    });
    const sortedStations = Object.keys(stationCounts)
      .map(name => ({
        name,
        count: stationCounts[name],
        percentage: ((stationCounts[name] / reports.length) * 100).toFixed(1) + '%'
      }))
      .sort((a, b) => b.count - a.count);

    // 2. Calculate consequence statistics
    const consequenceCounts: { [key: string]: number } = {};
    reports.forEach(r => {
      consequenceCounts[r.consecuencia] = (consequenceCounts[r.consecuencia] || 0) + 1;
    });
    const sortedConsequences = Object.keys(consequenceCounts)
      .map(name => ({
        name,
        count: consequenceCounts[name],
        percentage: ((consequenceCounts[name] / reports.length) * 100).toFixed(1) + '%'
      }))
      .sort((a, b) => b.count - a.count);

    // 3. Filter open reports
    const openReportsList = reports.filter(r => r.estado === 'Abierto');

    // Create jsPDF instance
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width; // 210mm
    const pageHeight = doc.internal.pageSize.height; // 297mm

    // --- Top Header Banner (Colored Canvas) ---
    // Background Slate Color: #0f172a
    doc.setFillColor(15, 23, 42);
    doc.rect(14, 12, pageWidth - 28, 26, 'F');

    // Title Texts over the Banner
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("AEROSERVICIOS GLECO 904, C.A.", 20, 21);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(186, 230, 253); // light blue sky text
    doc.text("SISTEMA DE GESTIÓN DE LA SEGURIDAD OPERACIONAL (SMS)", 20, 27);
    doc.setFont("Helvetica", "bold");
    doc.text("INFORME EJECUTIVO DE CONTROL DE PELIGROS", 20, 33);

    // Add company logo in white rounded container on top right of the banner
    if (logoBase64) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth - 14 - 36, 14, 32, 22, 2, 2, 'F');
        doc.addImage(logoBase64, 'PNG', pageWidth - 14 - 34, 15, 28, 20);
      } catch (e) {
        console.warn("Could not draw logo in hazards PDF:", e);
      }
    }

    // --- Sub-Header metadata ---
    doc.setTextColor(15, 23, 42); // slate 900
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("DETALLES DEL INFORME", 14, 46);
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 48, pageWidth - 14, 48);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 53);
    doc.text("Generado por: Jefatura de Gestión de la Seguridad Operacional", 14, 58);
    doc.text("Distribución: Operaciones, Mantenimiento, Servicios de Tierra y Rampa", 14, 63);

    doc.setFont("Helvetica", "bold");
    doc.text("Estado del Sistema:", 135, 53);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text("MONITOREADO E INTEGRADO", 166, 53);
    
    // Calculate report range dynamically from current dataset
    const reportNumbers = reports
      .map(r => parseInt(r.id.replace('N-SMS-', ''), 10))
      .filter(n => !isNaN(n));
    const minId = reportNumbers.length > 0 ? Math.min(...reportNumbers) : 277;
    const maxId = reportNumbers.length > 0 ? Math.max(...reportNumbers) : 1106;

    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFont("Helvetica", "normal");
    doc.text("Rango de Registros:", 135, 58);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`N-SMS-${minId} a N-SMS-${maxId}`, 166, 58);

    doc.setTextColor(71, 85, 105);
    doc.setFont("Helvetica", "normal");
    doc.text("Ámbito de Reportes:", 135, 63);
    doc.setFont("Helvetica", "bold");
    doc.text("Seguridad Operacional (SMS)", 166, 63);

    // --- Colored KPI Dashboard Cards ---
    // Card 1: Total
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(14, 69, 42, 20, 3, 3, 'F');
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text("TOTAL REPORTES", 18, 74);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${stats.total}`, 18, 83);

    // Card 2: Cerrados
    doc.setFillColor(209, 250, 229); // emerald-100
    doc.roundedRect(60, 69, 42, 20, 3, 3, 'F');
    doc.setTextColor(6, 95, 70); // emerald-800
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text("CERRADOS (RESUELTOS)", 64, 74);
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${stats.cerrados} (${stats.tasaCierre.toFixed(1)}%)`, 64, 83);

    // Card 3: Abiertos
    doc.setFillColor(254, 226, 226); // red-100
    doc.roundedRect(106, 69, 42, 20, 3, 3, 'F');
    doc.setTextColor(153, 27, 27); // red-800
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text("ABIERTOS (RIESGOS)", 110, 74);
    doc.setTextColor(220, 38, 38); // red-600
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${stats.abiertos}`, 110, 83);

    // Card 4: Promedio Resolución
    doc.setFillColor(224, 242, 254); // sky-100
    doc.roundedRect(152, 69, 44, 20, 3, 3, 'F');
    doc.setTextColor(7, 89, 133); // sky-800
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text("TIEMPO PROMEDIO", 156, 74);
    doc.setTextColor(2, 132, 199); // sky-600
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${stats.avgDaysToClose.toFixed(1)} días`, 156, 83);

    // --- Section 1: Distribución por Estación (Table) ---
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("1. DISTRIBUCIÓN DE REPORTES POR ESTACIÓN", 14, 96);
    doc.line(14, 98, pageWidth - 14, 98);

    const stationTableBody = sortedStations.map(st => [st.name, `${st.count} reportes`, st.percentage]);
    
    autoTable(doc, {
      startY: 101,
      head: [['Estación / Aeropuerto', 'Cantidad de Reportes', 'Porcentaje del Total']],
      body: stationTableBody,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8.5, halign: 'left' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 55 },
        2: { cellWidth: 47 }
      },
      margin: { left: 14, right: 14 }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- Section 2: Consecuencias Identificadas ---
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("2. PRINCIPALES CONSECUENCIAS IDENTIFICADAS", 14, currentY);
    doc.line(14, currentY + 2, pageWidth - 14, currentY + 2);

    const consequenceTableBody = sortedConsequences.map(c => [c.name, `${c.count} casos`, c.percentage]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Consecuencia Operacional', 'Frecuencia de Casos', 'Porcentaje de Presencia']],
      body: consequenceTableBody,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8.5, halign: 'left' },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 45 },
        2: { cellWidth: 37 }
      },
      margin: { left: 14, right: 14 }
    });

    // Add page for Section 3 (Open Hazards)
    doc.addPage();

    // --- Section 3: Registro de Peligros Abiertos Críticos ---
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("3. CONTROL DETALLADO DE RIESGOS ACTIVOS (REPORTES ABIERTOS)", 14, 16);
    
    doc.setFillColor(220, 38, 38); // red-600
    doc.rect(14, 19, pageWidth - 28, 1, 'F');

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Los siguientes ${stats.abiertos} reportes se encuentran activos ("Abiertos"). Representan condiciones inseguras que requieren de acciones correctoras inmediatas por los departamentos involucrados.`, 14, 25, { maxWidth: pageWidth - 28 });

    const openReportsTableBody = openReportsList.map(r => [
      r.id,
      formatFecha(r.fecha),
      r.estacion,
      r.peligro,
      r.consecuencia
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['ID Reporte', 'Fecha', 'Estación', 'Peligro / Condición Insegura', 'Consecuencia Esperada']],
      body: openReportsTableBody,
      theme: 'striped',
      headStyles: { fillColor: [185, 28, 28], fontSize: 8.5, halign: 'left' }, // Red header for alert!
      styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 20 },
        2: { cellWidth: 22 },
        3: { cellWidth: 62 },
        4: { cellWidth: 58 }
      },
      margin: { left: 14, right: 14 }
    });

    // --- Page numbering & Footer on all pages ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Separator line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
      
      // Footer texts
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("Aeroservicios Gleco 904, C.A.  |  Gestión de Seguridad Operacional SMS", 14, pageHeight - 7);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
    }

    doc.save(`SMS_Informe_Gleco_904_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Download Raw Data as CSV (Excel compatible with UTF-8 BOM)
  const handleDownloadRawDataCSV = (exportFilteredOnly = false) => {
    const dataset = exportFilteredOnly ? filteredReports : reports;
    const headers = [
      "ID Reporte",
      "Fecha",
      "Estación",
      "Peligro / Condición Insegura",
      "Consecuencia Operacional",
      "Fecha de Cierre",
      "Días Transcurridos",
      "Estado"
    ];

    const escapeCSV = (val: string | number | null | undefined) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headerLine = headers.map(h => escapeCSV(h)).join(',');
    const rowsLines = dataset.map(r => [
      escapeCSV(r.id),
      escapeCSV(r.fecha),
      escapeCSV(r.estacion),
      escapeCSV(r.peligro),
      escapeCSV(r.consecuencia),
      escapeCSV(r.fechaCierre || ''),
      escapeCSV(r.dias !== null && r.dias !== undefined ? r.dias : ''),
      escapeCSV(r.estado)
    ].join(',')).join('\r\n');

    // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows/Mac renders accents and special characters cleanly
    const csvContent = '\uFEFF' + headerLine + '\r\n' + rowsLines;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filterTag = exportFilteredOnly ? '_Filtrados' : '_Completo';
    link.download = `SMS_Reportes_Peligros_Datos_Crudos${filterTag}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download Raw Data as JSON
  const handleDownloadRawDataJSON = (exportFilteredOnly = false) => {
    const dataset = exportFilteredOnly ? filteredReports : reports;
    const jsonStr = JSON.stringify(dataset, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filterTag = exportFilteredOnly ? '_Filtrados' : '_Completo';
    link.download = `SMS_Reportes_Peligros_Datos_Crudos${filterTag}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered and searched reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchSearch = 
        r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.peligro.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.consecuencia.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStation = stationFilter === 'all' || r.estacion === stationFilter;
      const matchStatus = statusFilter === 'all' || r.estado === statusFilter;
      const matchConsecuencia = consecuenciaFilter === 'all' || r.consecuencia === consecuenciaFilter;

      return matchSearch && matchStation && matchStatus && matchConsecuencia;
    });
  }, [reports, searchTerm, stationFilter, statusFilter, consecuenciaFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stationFilter, statusFilter, consecuenciaFilter]);

  // Paginated data
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReports.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredReports, currentPage]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage) || 1;

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    const total = reports.length;
    const abiertos = reports.filter(r => r.estado === 'Abierto').length;
    const cerrados = reports.filter(r => r.estado === 'Cerrado').length;
    const tasaCierre = total > 0 ? (cerrados / total) * 100 : 0;
    
    // Avg days to close (excluding nulls or negative days)
    const closedReportsWithDays = reports.filter(r => r.estado === 'Cerrado' && r.dias !== null && r.dias >= 0);
    const totalDays = closedReportsWithDays.reduce((acc, curr) => acc + (curr.dias || 0), 0);
    const avgDaysToClose = closedReportsWithDays.length > 0 ? totalDays / closedReportsWithDays.length : 0;

    // Station distribution
    const stationCounts: { [key: string]: number } = {};
    reports.forEach(r => {
      stationCounts[r.estacion] = (stationCounts[r.estacion] || 0) + 1;
    });
    const stationChartData = Object.keys(stationCounts).map(name => ({
      name,
      cantidad: stationCounts[name]
    })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 7); // Show top 7

    // Status distribution
    const statusChartData = [
      { name: 'Cerrados', value: cerrados, color: '#10b981' },
      { name: 'Abiertos', value: abiertos, color: '#ef4444' }
    ];

    // Consequence distribution
    const consequenceCounts: { [key: string]: number } = {};
    reports.forEach(r => {
      consequenceCounts[r.consecuencia] = (consequenceCounts[r.consecuencia] || 0) + 1;
    });
    const consequenceChartData = Object.keys(consequenceCounts).map(name => ({
      name: name.length > 30 ? name.substring(0, 30) + '...' : name,
      cantidad: consequenceCounts[name]
    })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5); // Show top 5

    return {
      total,
      abiertos,
      cerrados,
      tasaCierre,
      avgDaysToClose,
      stationChartData,
      statusChartData,
      consequenceChartData
    };
  }, [reports]);

  // Helper formatting dates beautifully
  const formatFecha = (fStr: string) => {
    if (!fStr) return '—';
    try {
      const parts = fStr.split('-');
      if (parts.length === 3) {
        // Return DD-MM-YYYY format for visual appeal matching user's image
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    } catch (e) {}
    return fStr;
  };

  return (
    <div className="space-y-8 bg-blue-100/70 -m-8 p-8 min-h-[calc(100vh-120px)] animate-fade-in">
      
      {/* Title & Add Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 backdrop-blur-xs p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 shrink-0 shadow-xs flex items-center justify-center">
            <img 
              src={LOGO_URL} 
              alt="Logo ASG Gleco 904" 
              className="h-11 w-auto object-contain"
            />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldCheck size={24} className="text-blue-700 hidden sm:inline" />
              Reportes de Peligros de Seguridad Operacional (SMS)
            </h3>
            <p className="text-xs sm:text-sm font-semibold text-blue-600 uppercase tracking-widest mt-0.5">
              Gestión Integral y Control de Riesgos GLECO 904
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleResetData}
            title="Restablecer base de datos a 830 reportes (desde 277 hasta 1106)"
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border border-slate-300 shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} />
            Reiniciar Base (830)
          </button>
          <button
            onClick={handleDownloadReport}
            title="Descargar Informe Resumen para compartir con otros departamentos"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-200 cursor-pointer"
          >
            <Download size={14} />
            Descargar Informe (PDF)
          </button>

          {/* Botón y menú para Descargar Datos Crudos */}
          <div className="relative">
            <button
              onClick={() => setIsRawMenuOpen(!isRawMenuOpen)}
              title="Descargar datos crudos en formato CSV (Excel) o JSON"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md shadow-slate-300 cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" />
              Descargar Datos Crudos
              <ChevronDown size={14} className={`transition-transform duration-200 ${isRawMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isRawMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsRawMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Exportar Datos Crudos</p>
                    <p className="text-xs font-black text-slate-800">{reports.length} reportes registrados</p>
                  </div>
                  <button
                    onClick={() => {
                      handleDownloadRawDataCSV(false);
                      setIsRawMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">CSV Completo (Excel)</p>
                      <p className="text-[10px] text-slate-400 font-normal">Base completa con UTF-8 para hojas de cálculo</p>
                    </div>
                  </button>
                  {filteredReports.length !== reports.length && (
                    <button
                      onClick={() => {
                        handleDownloadRawDataCSV(true);
                        setIsRawMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-xs font-bold text-slate-700 transition-colors border-t border-slate-100 cursor-pointer"
                    >
                      <Filter size={16} className="text-blue-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800">CSV (Filtros Activos)</p>
                        <p className="text-[10px] text-slate-400 font-normal">{filteredReports.length} reportes según búsqueda actual</p>
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleDownloadRawDataJSON(false);
                      setIsRawMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 text-xs font-bold text-slate-700 transition-colors border-t border-slate-100 cursor-pointer"
                  >
                    <FileCode size={16} className="text-purple-600 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">Formato JSON</p>
                      <p className="text-[10px] text-slate-400 font-normal">Estructura cruda para integración de sistemas</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-200 cursor-pointer"
          >
            <Plus size={16} />
            Nuevo Reporte de Peligro
          </button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Reports */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Plane size={20} />
            </div>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
              Histórico
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 relative z-10">Total de Reportes</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight relative z-10">{stats.total}</h3>
          <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-tighter">Acumulado en todas las estaciones</p>
        </div>

        {/* Card 2: Open Reports */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-red-50 rounded-full group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <span className="text-[10px] font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">
              Riesgo Activo
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 relative z-10">Reportes Abiertos</p>
          <h3 className="text-3xl font-black text-red-600 tracking-tight relative z-10">{stats.abiertos}</h3>
          <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-tighter">Requieren acción inmediata</p>
        </div>

        {/* Card 3: Closed Reports */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle size={20} />
            </div>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
              Mitigados
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 relative z-10">Tasa de Resolución</p>
          <h3 className="text-3xl font-black text-emerald-600 tracking-tight relative z-10">
            {stats.tasaCierre.toFixed(1)}%
          </h3>
          <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-tighter">
            {stats.cerrados} reportes cerrados con éxito
          </p>
        </div>

        {/* Card 4: Average Days to Close */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100">
              Tiempo Respuesta
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 relative z-10">Cierre Promedio</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight relative z-10">
            {stats.avgDaysToClose.toFixed(1)}
            <span className="text-sm font-semibold text-slate-400 ml-1">días</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-tighter">Para cierre de la no conformidad</p>
        </div>
      </div>

      {/* Analytics Subsection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Reports by Station */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm col-span-1 lg:col-span-2">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building size={16} className="text-blue-600" />
            Distribución de Peligros por Estación (Top 7)
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.stationChartData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: '600' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }} 
                />
                <Bar dataKey="cantidad" radius={[6, 6, 0, 0]}>
                  {stats.stationChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#1d4ed8' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Status breakdown and top consequences list */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Principales Consecuencias de Peligros
            </h4>
            <div className="space-y-3.5">
              {stats.consequenceChartData.map((con, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate" title={con.name}>{con.name}</p>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full" 
                        style={{ width: `${(con.cantidad / reports.length) * 100}%` }} 
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-500 shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                    {con.cantidad}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase">Estado General del Sistema</span>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-slate-600">Cerrados ({stats.cerrados})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-slate-600">Abiertos ({stats.abiertos})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Database Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Toolbar / Filters */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nº Reporte, peligro, consecuencia..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 placeholder-slate-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtros:</span>
            </div>

            {/* Station Filter */}
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">Estación: Todas</option>
              {stations.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">Estado: Todos</option>
              <option value="Abierto">Abierto</option>
              <option value="Cerrado">Cerrado</option>
            </select>

            {/* Consequence Filter */}
            <select
              value={consecuenciaFilter}
              onChange={(e) => setConsecuenciaFilter(e.target.value)}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[200px] cursor-pointer truncate"
            >
              <option value="all">Consecuencia: Todas</option>
              {consecuencias.map(cons => (
                <option key={cons} value={cons}>{cons}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Real Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[110px]">Nº Reporte</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[110px]">Fecha</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[100px]">Estación</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[280px]">Reporte / Peligro</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[240px]">Consecuencia</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[110px]">Fecha Cierre</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[80px] text-center">Días</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[110px] text-center">Estado del Reporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedReports.length > 0 ? (
                paginatedReports.map((report) => (
                  <tr 
                    key={report.id} 
                    className={cn(
                      "hover:bg-slate-50/80 transition-colors duration-150",
                      report.estado === 'Abierto' ? 'bg-red-50/20' : ''
                    )}
                  >
                    {/* Nº Reporte */}
                    <td className="p-4 text-xs font-bold text-blue-900 font-mono tracking-tight">
                      {report.id}
                    </td>
                    
                    {/* Fecha */}
                    <td className="p-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {formatFecha(report.fecha)}
                    </td>

                    {/* Estación */}
                    <td className="p-4">
                      <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-md border border-slate-200">
                        {report.estacion}
                      </span>
                    </td>

                    {/* Reporte / Peligro */}
                    <td className="p-4 text-xs text-slate-700 font-semibold leading-relaxed max-w-sm">
                      {report.peligro}
                    </td>

                    {/* Consecuencia */}
                    <td className="p-4 text-xs text-slate-500 font-medium leading-relaxed max-w-xs">
                      {report.consecuencia}
                    </td>

                    {/* Fecha Cierre */}
                    <td className="p-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {formatFecha(report.fechaCierre)}
                    </td>

                    {/* Días para Cerrar */}
                    <td className="p-4 text-xs font-bold font-mono text-center text-slate-600">
                      {report.dias !== null ? report.dias : '—'}
                    </td>

                    {/* Estado de Reporte */}
                    <td className="p-4 text-center">
                      <span 
                        className={cn(
                          "inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          report.estado === 'Abierto' 
                            ? "bg-red-50 text-red-700 border-red-200" 
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}
                      >
                        {report.estado}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    No se encontraron reportes que coincidan con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination info */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs font-semibold text-slate-500">
            Mostrando <span className="text-slate-800">{filteredReports.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredReports.length)}</span> de <span className="text-slate-800">{filteredReports.length}</span> reportes
            {filteredReports.length !== reports.length && (
              <span className="text-blue-600 ml-1"> (filtrados de {reports.length} totales)</span>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-500 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              
              {/* Visible Pages logic to not overload the screen */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                // Ensure pageNum stays within bounds
                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      currentPage === pageNum 
                        ? "bg-blue-700 text-white shadow-md shadow-blue-100" 
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-500 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD REPORT FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl relative overflow-hidden animate-scale-in my-8">
            
            {/* Header decor */}
            <div className="bg-blue-950 px-6 py-5 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-800 rounded-lg flex items-center justify-center text-white">
                  <Plus size={16} />
                </div>
                <div>
                  <h4 className="font-black text-sm tracking-tight">Agregar Reporte de Peligro SMS</h4>
                  <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">Seguridad Operacional</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-full hover:bg-blue-900 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleAddReport} className="p-6 space-y-4">
              
              {successMessage ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col items-center text-center justify-center space-y-2 animate-pulse">
                  <CheckCircle size={32} className="text-emerald-500" />
                  <p className="text-xs font-bold text-emerald-800">{successMessage}</p>
                </div>
              ) : (
                <>
                  {formError && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-red-700 font-bold">
                      <AlertTriangle size={16} className="shrink-0 text-red-500 mt-0.5" />
                      <div>{formError}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* ID Field */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                        Nº Reporte <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newReport.id}
                        onChange={(e) => setNewReport(prev => ({ ...prev, id: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder={nextSuggestedId}
                        required
                      />
                    </div>

                    {/* Fecha Field */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                        Fecha de Reporte <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={newReport.fecha}
                        onChange={(e) => setNewReport(prev => ({ ...prev, fecha: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Estación Field */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                        Estación <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={newReport.estacion}
                        onChange={(e) => setNewReport(prev => ({ ...prev, estacion: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                      >
                        <option value="MAQUETIA">MAQUETIA</option>
                        <option value="BARCELONA">BARCELONA</option>
                        <option value="PORLAMAR">PORLAMAR</option>
                        <option value="MIQ">MIQ (Maiquetía)</option>
                        <option value="PMV">PMV</option>
                        <option value="LA FRIA">LA FRIA</option>
                        <option value="VIGIA">VIGIA</option>
                        <option value="STD">STD</option>
                        <option value="LSP">LSP</option>
                        <option value="PZO">PZO</option>
                      </select>
                    </div>

                    {/* Estado Field */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                        Estado Inicial <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewReport(prev => ({ ...prev, estado: 'Abierto' }))}
                          className={cn(
                            "flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                            newReport.estado === 'Abierto'
                              ? "bg-red-50 text-red-700 border-red-300 shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                          )}
                        >
                          Abierto
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewReport(prev => ({ ...prev, estado: 'Cerrado' }))}
                          className={cn(
                            "flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                            newReport.estado === 'Cerrado'
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                          )}
                        >
                          Cerrado
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reporte / Peligro Field */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                      Descripción del Reporte / Peligro <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={newReport.peligro}
                      onChange={(e) => setNewReport(prev => ({ ...prev, peligro: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-20 resize-none"
                      placeholder="Ej. Se detectaron luces de eje de pista inoperativas en sector Charlie..."
                      required
                    />
                  </div>

                  {/* Consecuencia Field */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                      Consecuencia Identificada <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newReport.consecuencia}
                      onChange={(e) => setNewReport(prev => ({ ...prev, consecuencia: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="Colisión con las aeronaves y EAT">Colisión con las aeronaves y EAT</option>
                      <option value="Incendio de EAT y daños colaterales">Incendio de EAT y daños colaterales</option>
                      <option value="Incendio en las operaciones">Incendio en las operaciones</option>
                      <option value="Descontrol de EAT que puede generar un choque con las aeronaves">Descontrol de EAT que puede generar un choque con las aeronaves</option>
                      <option value="Daño por objeto extraño a aeronaves">Daño por objeto extraño a aeronaves</option>
                      <option value="Daño o choque de la aeronave o EAT">Daño o choque de la aeronave o EAT</option>
                      <option value="Derrame de agua servida">Derrame de agua servida</option>
                      <option value="Daño al personal - Compromete la Seguridad Operativa">Daño al personal - Compromete la Seguridad Operativa</option>
                      <option value="Fuego">Fuego</option>
                    </select>
                  </div>

                  {/* Fecha de Cierre Field (Only shown if status is closed) */}
                  {newReport.estado === 'Cerrado' && (
                    <div className="animate-fade-in">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                        Fecha de Cierre <span className="text-xs text-slate-400">(Opcional, por defecto hoy)</span>
                      </label>
                      <input
                        type="date"
                        value={newReport.fechaCierre}
                        onChange={(e) => setNewReport(prev => ({ ...prev, fechaCierre: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  )}

                  {/* Submit / Cancel buttons */}
                  <div className="flex gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-200 cursor-pointer"
                    >
                      Guardar Reporte
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
