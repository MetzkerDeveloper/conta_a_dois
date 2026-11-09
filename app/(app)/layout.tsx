import { DemoProvider } from '@/features/demo/components/demo-provider';
import { AppShell } from '@/features/demo/components/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <AppShell>{children}</AppShell>
    </DemoProvider>
  );
}
