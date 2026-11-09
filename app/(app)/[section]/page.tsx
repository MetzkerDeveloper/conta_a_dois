import { notFound } from 'next/navigation';
import { DemoScreen } from '@/features/demo/components/demo-screen';

const sections = ['despesas', 'rendas', 'repasses', 'ajustes'] as const;

export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const selected = sections.find((item) => item === section);
  if (!selected) notFound();
  return <DemoScreen section={selected} />;
}
