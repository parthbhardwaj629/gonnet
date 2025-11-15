
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from './pages/Home';
import InputPage from "./pages/InputPage";
import DisplayPage from "./pages/DisplayPage";
import QRPage from "./pages/QRPage";
import Feature from "./pages/Feature";

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/profile/:uniqueId/input" element={<InputPage/>} />
        <Route path="/profile/:uniqueId/view" element={<DisplayPage/>} />
        <Route path="/profile/:uniqueId/qr" element={<QRPage/>} />
        <Route path="/:feature" element={<Feature/>} />
      </Routes>
    </BrowserRouter>
  );
}