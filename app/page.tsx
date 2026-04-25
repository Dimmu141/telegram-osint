import { prisma } from "@/lib/prisma";
import MessageFeed, { type MessageRow } from "./components/MessageFeed";

export const revalidate = 300;

export default async function Home() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const messages = await prisma.message.findMany({
    where: {
      postedAt: { gte: since },
      llmProcessedAt: { not: null },
    },
    orderBy: { postedAt: "desc" },
    select: {
      id: true,
      translationEn: true,
      topic: true,
      significance: true,
      entities: true,
      summary: true,
      postedAt: true,
      channel: {
        select: {
          handle: true,
          nameEn: true,
          category: true,
        },
      },
    },
  });

  const rows: MessageRow[] = messages.map((m) => ({
    ...m,
    postedAt: m.postedAt.toISOString(),
  }));

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Telegram OSINT</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Russian-language channels · last 24h · {messages.length} classified messages
        </p>
      </header>
      <MessageFeed messages={rows} />
    </main>
  );
}
