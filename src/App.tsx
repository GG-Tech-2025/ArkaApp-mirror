import React, { useState } from "react";
import EmployeeApp from "./employee/pages/EmployeeApp";
import AdminApp from "./AdminApp";
import AppSelector from "./AppSelector";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* App selection */}
        <Route path="/" element={<AppSelector />} />

        {/* Employee module (route-driven) */}
        <Route path="/employee/*" element={<EmployeeApp />} />

        {/* Admin module (state-driven for now, untouched) */}
        <Route path="/admin/*" element={<AdminApp />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
