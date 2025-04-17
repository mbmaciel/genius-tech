import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Dashboard } from "@/pages/dashboard";
import { Login } from "@/pages/login";
import { BotPage } from "@/pages/bot-page";

function App() {
  const [location] = useLocation();

  return (
    <div className="App">
      <Toaster />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/login" component={Login} />
        <Route path="/bot" component={BotPage} />
      </Switch>
    </div>
  );
}

export default App;