import { createFileRoute } from "@tanstack/react-router";
import { KiloTable } from "@/components/kilo/play";

export const Route = createFileRoute("/replay")({ component: Replay });

function Replay() {
  return <KiloTable review />;
}
