import { createRoot } from "react-dom/client";
import { KiloTable } from "./components/kilo/play";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <KiloTable review={new URLSearchParams(location.search).has("review")} />,
);
