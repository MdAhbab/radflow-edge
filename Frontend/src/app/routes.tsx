import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { Welcome } from "./components/screens/Welcome";
import { Worklist } from "./components/screens/Worklist";
import { CaseReview } from "./components/screens/CaseReview";
import { Escalations } from "./components/screens/Escalations";
import { SpecialistReview } from "./components/screens/SpecialistReview";
import { NewReport } from "./components/screens/NewReport";
import { SystemStatus } from "./components/screens/SystemStatus";
import { EHR } from "./components/screens/EHR";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Welcome,
  },
  {
    path: "/dashboard",
    Component: AppLayout,
    children: [
      { index: true, Component: Worklist },
      { path: "case/:patientId", Component: CaseReview },
      { path: "escalations", Component: Escalations },
      { path: "specialist/:patientId", Component: SpecialistReview },
      { path: "new-report", Component: NewReport },
      { path: "ehr", Component: EHR },
      { path: "settings", Component: SystemStatus },
    ],
  },
]);
