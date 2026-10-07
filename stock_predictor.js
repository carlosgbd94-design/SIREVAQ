/**
 * stock_predictor.js — Motor de Pronóstico de Desabasto Basado en Semanas Operativas
 * Determina el ritmo de consumo semanal, semanas de autonomía y calcula días activos
 * inspeccionando los días de atención registrados (incluyendo Sábado y Domingo en directorio BCG).
 */

(function (window) {
  'use strict';

  // ── 1. Obtener Días Operativos por Semana para una Unidad ───────────────────
  /**
   * Consulta los días de operación de una unidad según el registro de apertura de frascos.
   * Regla de negocio: Si registra apertura el Sábado O el Domingo, la unidad labora fin de semana completo (7 días).
   * De lo contrario, labora jornada estándar de Lunes a Viernes (5 días).
   * @param {string} clues CLUES de la unidad
   */
  function getOperatingDaysPerWeek(clues) {
    const defaultDays = 5; // Lunes a Viernes
    if (!clues) return defaultDays;

    // Buscar en datos cargados de BCG apertura en ventana global
    const aperturas = window.bcgDirAperturas || window._bcgAperturasCache || [];
    const unitAperturas = aperturas.filter(a => a.clues === clues);

    if (!unitAperturas.length) return defaultDays;

    // Verificar si registra Sábado O Domingo
    const hasWeekend = unitAperturas.some(ap => {
      const day = (ap.dia_semana || '').toLowerCase();
      return day.includes('sáb') || day.includes('sab') || day.includes('dom');
    });

    // Si abre cualquiera de los dos días del fin de semana = 7 días laborales/semana. De lo contrario = 5 días.
    return hasWeekend ? 7 : 5;
  }

  // ── 2. Algoritmo de Consumo Semanal (Weekly Burn Rate) ──────────────────────
  /**
   * Calcula el promedio semanal de dosis aplicadas y la tendencia
   * @param {Array} historicalApplies Array de { fecha: 'YYYY-MM-DD', dosis: number }
   */
  function calculateWeeklyBurnRate(historicalApplies = []) {
    if (!historicalApplies || historicalApplies.length === 0) {
      return { weeklyBurnRate: 0, totalWeeks: 0, trend: 'stable' };
    }

    // Filtrar capturas con aplicaciones > 0
    const validReports = historicalApplies.filter(item => Number(item.dosis) > 0);
    const totalDoses = historicalApplies.reduce((acc, curr) => acc + (Number(curr.dosis) || 0), 0);
    const totalWeeks = Math.max(1, historicalApplies.length);

    const weeklyBurnRate = totalDoses / totalWeeks;

    // Tendencia basada en las últimas semanas
    let trend = 'stable';
    if (validReports.length >= 2) {
      const last = Number(validReports[validReports.length - 1].dosis || 0);
      const prev = Number(validReports[validReports.length - 2].dosis || 0);
      if (last > prev * 1.2) trend = 'increasing';
      else if (last < prev * 0.8) trend = 'decreasing';
    }

    return {
      weeklyBurnRate: parseFloat(weeklyBurnRate.toFixed(1)),
      totalWeeks: totalWeeks,
      totalDoses: totalDoses,
      trend: trend
    };
  }

  // ── 3. Diagnóstico de Autonomía en Semanas & Días ──────────────────────────
  /**
   * Diagnostica las semanas de autonomía del inventario actual
   */
  function diagnoseStockout(currentStock, weeklyBurnRate, operatingDaysPerWeek = 5) {
    const stock = Math.max(0, Number(currentStock) || 0);
    const rate = Math.max(0, Number(weeklyBurnRate) || 0);

    if (stock === 0) {
      return {
        autonomyWeeks: 0,
        autonomyDays: 0,
        riskLevel: 'CRITICAL',
        badgeColor: 'bg-rose-50 border-rose-200 text-rose-800',
        statusLabel: 'Desabasto Total (0 dosis)',
        icon: 'error',
        recommendation: 'Requerimiento urgente de remesa de reposición'
      };
    }

    if (rate === 0) {
      return {
        autonomyWeeks: null,
        autonomyDays: null,
        riskLevel: 'STAGNANT',
        badgeColor: 'bg-slate-100 border-slate-300 text-slate-700',
        statusLabel: 'Sin Consumo Registrado',
        icon: 'pause_circle',
        recommendation: 'Esperando primera captura de la campaña'
      };
    }

    // Semanas de autonomía
    const autonomyWeeks = parseFloat((stock / rate).toFixed(1));
    const dailyRate = rate / operatingDaysPerWeek;
    const autonomyDays = Math.round(stock / (dailyRate || 1));

    if (autonomyWeeks < 1) {
      return {
        autonomyWeeks,
        autonomyDays,
        riskLevel: 'CRITICAL',
        badgeColor: 'bg-rose-50 border-rose-200 text-rose-800',
        statusLabel: `Desabasto en ${autonomyWeeks} sem. (${autonomyDays} días oper.)`,
        icon: 'warning',
        recommendation: 'Solicitar reasignación o traspaso urgente'
      };
    }

    if (autonomyWeeks <= 2) {
      return {
        autonomyWeeks,
        autonomyDays,
        riskLevel: 'WARNING',
        badgeColor: 'bg-amber-50 border-amber-200 text-amber-900',
        statusLabel: `Autonomía: ${autonomyWeeks} sem. (${autonomyDays} días oper.)`,
        icon: 'report_problem',
        recommendation: 'Programar reposición de biológico esta semana'
      };
    }

    return {
      autonomyWeeks,
      autonomyDays,
      riskLevel: 'HEALTHY',
      badgeColor: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      statusLabel: `Suministro Óptimo (${autonomyWeeks} sem. / ${autonomyDays} d)`,
      icon: 'check_circle',
      recommendation: 'Nivel de inventario dentro de rango seguro'
    };
  }

  // ── 4. Renderizador de Widget Horizontal en 1 Fila ────────────────────────
  function renderPredictiveWidget(containerId, stock, historicalApplies, clues = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const opDays = getOperatingDaysPerWeek(clues || window.USER?.clues);
    const { weeklyBurnRate, trend } = calculateWeeklyBurnRate(historicalApplies);
    const diag = diagnoseStockout(stock, weeklyBurnRate, opDays);

    const trendIcon = trend === 'increasing' ? 'trending_up' : trend === 'decreasing' ? 'trending_down' : 'trending_flat';

    let badgeStyle = 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
    let riskColorClass = 'text-slate-800';

    if (diag.riskLevel === 'CRITICAL') {
      badgeStyle = 'background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;';
      riskColorClass = 'text-rose-600';
    } else if (diag.riskLevel === 'WARNING') {
      badgeStyle = 'background: #fffbeb; color: #92400e; border: 1px solid #fde68a;';
      riskColorClass = 'text-amber-600';
    } else if (diag.riskLevel === 'HEALTHY') {
      badgeStyle = 'background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;';
      riskColorClass = 'text-emerald-600';
    }

    // Texto limpio de autonomía sin infinito
    const autonomyText = diag.autonomyWeeks === null 
      ? 'Sin consumo previo' 
      : `${diag.autonomyWeeks} sem. <span style="font-size: 12px; font-weight: 600; color: #64748b;">(~${diag.autonomyDays} d. opert.)</span>`;

    container.innerHTML = `
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 20px; padding: 14px 20px; box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.02); display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;" class="w-full">
        
        <!-- Título y Recomendación -->
        <div style="display: flex; align-items: center; gap: 12px; min-width: 240px; flex: 1.2;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: #f0f9ff; border: 1px solid #e0f2fe; display: flex; align-items: center; justify-content: center; color: #0284c7; flex-shrink: 0;">
            <span class="material-symbols-rounded" style="font-size: 22px;">analytics</span>
          </div>
          <div>
            <h4 style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">Pronóstico de Abasto & Autonomía</h4>
            <span style="font-size: 12px; font-weight: 600; color: #64748b;">${diag.recommendation} • <strong style="color: #0369a1;">Jornada: ${opDays} días/sem</strong></span>
          </div>
        </div>

        <!-- Métrica 1: Ritmo Semanal -->
        <div style="display: flex; align-items: center; gap: 8px; padding: 0 16px; border-left: 1px solid #f1f5f9;">
          <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">Ritmo Semanal:</span>
          <span style="font-size: 14px; font-weight: 800; color: #0f172a;">${weeklyBurnRate} <span style="font-size: 12px; font-weight: 600; color: #94a3b8;">dosis/sem</span></span>
        </div>

        <!-- Métrica 2: Tendencia -->
        <div style="display: flex; align-items: center; gap: 6px; padding: 0 16px; border-left: 1px solid #f1f5f9;">
          <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">Tendencia:</span>
          <span style="font-size: 13px; font-weight: 800; color: #0369a1; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-rounded" style="font-size: 18px;">${trendIcon}</span>
            ${trend === 'increasing' ? 'Acelerada' : trend === 'decreasing' ? 'Baja' : 'Estable'}
          </span>
        </div>

        <!-- Métrica 3: Autonomía -->
        <div style="display: flex; align-items: center; gap: 6px; padding: 0 16px; border-left: 1px solid #f1f5f9;">
          <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">Autonomía:</span>
          <span class="${riskColorClass}" style="font-size: 14px; font-weight: 900;">${autonomyText}</span>
        </div>

        <!-- Insignia Estado -->
        <div style="${badgeStyle} border-radius: 12px; padding: 6px 12px; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; white-space: nowrap;">
          <span class="material-symbols-rounded" style="font-size: 16px;">${diag.icon}</span>
          <span>${diag.statusLabel}</span>
        </div>

      </div>
    `;
  }

  // Exportar API Global
  window.StockPredictor = {
    getOperatingDaysPerWeek,
    calculateWeeklyBurnRate,
    diagnoseStockout,
    renderPredictiveWidget
  };

})(window);

