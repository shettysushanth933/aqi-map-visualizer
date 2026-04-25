import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './pages/DashboardLayout';
import TrafficPage from './pages/TrafficPage';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<DashboardLayout />} />
            <Route path="/traffic" element={<TrafficPage />} />
        </Routes>
    );
}
