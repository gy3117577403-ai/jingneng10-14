import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/Layout/MainLayout";
import { Dashboard } from "./pages/Dashboard/Dashboard";
import { QuoteList } from "./pages/Quotes/QuoteList";
import { QuoteForm } from "./pages/Quotes/QuoteForm";
import { QuoteDetail } from "./pages/Quotes/QuoteDetail";
import { Approvals } from "./pages/Approvals/Approvals";
import { Contacts } from "./pages/Contacts/Contacts";
import { Apps, ComingSoon } from "./pages/Apps/Apps";
import "./styles/global.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/quotes" element={<QuoteList />} />
          <Route path="/quotes/new" element={<QuoteForm />} />
          <Route path="/quotes/:id" element={<QuoteDetail />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/apps" element={<Apps />} />
          {/* 即将上线的应用：路由占位，接上后替换为真实页面 */}
          <Route path="/apps/price" element={<ComingSoon name="价格库" />} />
          <Route path="/apps/drawing" element={<ComingSoon name="图纸快速分解" />} />
          <Route path="/apps/quickquote" element={<ComingSoon name="快速报价" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
