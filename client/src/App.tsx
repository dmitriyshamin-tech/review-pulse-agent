import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import BrandsPage from "@/pages/brands";
import BrandDetailPage from "@/pages/brand-detail";
import SourcesPage from "@/pages/sources";
import FeedPage from "@/pages/feed";
import MonitorPage from "@/pages/monitor";
import RankingPage from "@/pages/ranking";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={BrandsPage} />
      <Route path="/brand/:id" component={BrandDetailPage} />
      <Route path="/ranking" component={RankingPage} />
      <Route path="/sources" component={SourcesPage} />
      <Route path="/feed" component={FeedPage} />
      <Route path="/monitor" component={MonitorPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
