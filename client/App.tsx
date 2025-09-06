import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function Header() {
  const location = useLocation();
  const tokenPresent = typeof window !== "undefined" && !!localStorage.getItem("gh_token");
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/60 bg-background/80 border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="size-7 rounded-md bg-gradient-to-br from-primary to-accent shadow" />
          <span className="font-extrabold tracking-tight text-lg">GitHub CRUD & Compiler</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/" className={`hover:text-primary ${location.pathname === "/" ? "text-primary font-semibold" : "text-muted-foreground"}`}>Home</Link>
          <span className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border ${tokenPresent ? "text-emerald-600 border-emerald-300 bg-emerald-50" : "text-orange-600 border-orange-300 bg-orange-50"}`}>
            <span className={`size-2 rounded-full ${tokenPresent ? "bg-emerald-500" : "bg-orange-500"}`} />
            {tokenPresent ? "GitHub Connected" : "GitHub Not Connected"}
          </span>
        </nav>
      </div>
    </header>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
