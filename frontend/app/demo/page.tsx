export default function DemoPackagingPage() {
  const pillars = [
    'Demo Walkthrough',
    'Investor Summary',
    'Pilot Readiness',
    'Capability Snapshot'
  ];
  return (
    <main>
      <h1>Orbit Control Packaging</h1>
      <p>Demo-, Investor- und Pilot-Paket für Orbit Control.</p>
      <ul>
        {pillars.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </main>
  );
}
