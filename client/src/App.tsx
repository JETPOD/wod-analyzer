import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import BenchmarksPage from "@/pages/benchmarks";
import HistoriquePage from "@/pages/historique";
import ProgrammationPage from "@/pages/programmation";
import { HistoryProvider } from "@/lib/HistoryContext";
import { AnalyzerStoreProvider } from "@/lib/analyzerStore";
import { CustomMovementsProvider } from "@/lib/CustomMovementsContext";
import { BodyweightProvider } from "@/lib/BodyweightContext";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/benchmarks" component={BenchmarksPage} />
      <Route path="/historique" component={HistoriquePage} />
      <Route path="/programmation" component={ProgrammationPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CustomMovementsProvider>
          <BodyweightProvider>
            <AnalyzerStoreProvider>
              <HistoryProvider>
                <Toaster />
                <Router hook={useHashLocation}>
                  <AppRouter />
                </Router>
              </HistoryProvider>
            </AnalyzerStoreProvider>
          </BodyweightProvider>
        </CustomMovementsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
