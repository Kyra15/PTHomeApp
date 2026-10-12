import { AppShell } from '../components/AppShell';

/** Placeholder for sidebar destinations that aren't built yet (later milestones). */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <AppShell title={title}>
      <div className="coming-soon">
        <h2>Coming soon</h2>
        <p>This part of the portal hasn't been built yet.</p>
      </div>
    </AppShell>
  );
}
