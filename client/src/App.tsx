import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import AuditAI from "./pages/AuditAI";
import CopyGenerator from "./pages/CopyGenerator";
import Goals from "./pages/Goals";
import ABTesting from "./pages/ABTesting";
import TrackingSetup from "./pages/TrackingSetup";
import AgentLogs from "./pages/AgentLogs";
import AlertsPage from "./pages/AlertsPage";
import ConnectAccount from "./pages/ConnectAccount";
import Home from "./pages/Home";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/campaigns">
        <DashboardLayout>
          <Campaigns />
        </DashboardLayout>
      </Route>
      <Route path="/audit">
        <DashboardLayout>
          <AuditAI />
        </DashboardLayout>
      </Route>
      <Route path="/copy">
        <DashboardLayout>
          <CopyGenerator />
        </DashboardLayout>
      </Route>
      <Route path="/goals">
        <DashboardLayout>
          <Goals />
        </DashboardLayout>
      </Route>
      <Route path="/ab-testing">
        <DashboardLayout>
          <ABTesting />
        </DashboardLayout>
      </Route>
      <Route path="/tracking">
        <DashboardLayout>
          <TrackingSetup />
        </DashboardLayout>
      </Route>
      <Route path="/logs">
        <DashboardLayout>
          <AgentLogs />
        </DashboardLayout>
      </Route>
      <Route path="/alerts">
        <DashboardLayout>
          <AlertsPage />
        </DashboardLayout>
      </Route>
      <Route path="/connect">
        <DashboardLayout>
          <ConnectAccount />
        </DashboardLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="top-right" richColors />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
