export type WhiteboardCardType = 'sticky' | 'kpi' | 'result';

export interface WhiteboardCard {
  id: string;
  type: WhiteboardCardType;
  title: string;
  body: string;
  x: number;
  y: number;
}

export function buildStarterBoard(): WhiteboardCard[] {
  return [
    { id: 'sticky-1', type: 'sticky', title: 'Nächster Schritt', body: 'Retail KPI-Review vorbereiten', x: 64, y: 72 },
    { id: 'kpi-1', type: 'kpi', title: 'Revenue Uplift', body: '+8.4% vs Vorwoche', x: 320, y: 88 },
    { id: 'result-1', type: 'result', title: 'AI Summary', body: 'Top-3 Maßnahmen priorisiert', x: 590, y: 140 }
  ];
}
