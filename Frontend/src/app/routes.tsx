import { createBrowserRouter } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { Welcome } from "./components/screens/Welcome";

// Dashboard screens are code-split so the landing page ships only what it
// needs; each screen loads on first navigation.
export const router = createBrowserRouter([
  {
    path: "/",
    Component: Welcome,
  },
  {
    path: "/dashboard",
    Component: AppLayout,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("./components/screens/Worklist")).Worklist }),
      },
      {
        path: "case/:patientId",
        lazy: async () => ({ Component: (await import("./components/screens/CaseReview")).CaseReview }),
      },
      {
        path: "escalations",
        lazy: async () => ({ Component: (await import("./components/screens/Escalations")).Escalations }),
      },
      {
        path: "specialist/:patientId",
        lazy: async () => ({ Component: (await import("./components/screens/SpecialistReview")).SpecialistReview }),
      },
      {
        path: "new-report",
        lazy: async () => ({ Component: (await import("./components/screens/NewReport")).NewReport }),
      },
      {
        path: "ehr",
        lazy: async () => ({ Component: (await import("./components/screens/EHR")).EHR }),
      },
      {
        path: "insights",
        lazy: async () => ({ Component: (await import("./components/screens/Insights")).Insights }),
      },
      {
        path: "settings",
        lazy: async () => ({ Component: (await import("./components/screens/SystemStatus")).SystemStatus }),
      },
    ],
  },
]);
