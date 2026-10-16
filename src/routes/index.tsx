import { createFileRoute } from "@tanstack/react-router";
import { KiloTable } from "@/components/kilo/play";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <KiloTable />;
}
