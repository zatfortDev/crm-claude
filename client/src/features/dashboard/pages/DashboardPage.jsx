import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';

// Placeholder estructural: los KPIs reales se conectan en la fase de dashboard.
const placeholders = ['Clientes', 'Nuevos leads', 'Oportunidades abiertas', 'Valor del pipeline'];

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Resumen de tu actividad comercial." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {placeholders.map((label) => (
          <Card key={label}>
            <CardContent>
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-2 text-2xl font-semibold">—</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
