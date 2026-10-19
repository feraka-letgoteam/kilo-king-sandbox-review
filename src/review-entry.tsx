import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import { KiloTable } from "./components/kilo/play";
import "./styles.css";
const FeatureLab = lazy(
  () => import("./components/kilo/feature-lab/FeatureLab"),
);
const query = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(
  query.get("featureLab") === "v50" ? (
    <Suspense fallback={<p>Loading mechanics study…</p>}>
      <FeatureLab />
    </Suspense>
  ) : (
    <KiloTable review={query.has("review")} />
  ),
);
