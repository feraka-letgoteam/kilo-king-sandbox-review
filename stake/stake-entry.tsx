// Static Stake build entry: the game only. No review panel, no feature lab.
import { createRoot } from "react-dom/client";
import { KiloTable } from "../src/components/kilo/play";
import "../src/styles.css";

createRoot(document.getElementById("root")!).render(<KiloTable />);
