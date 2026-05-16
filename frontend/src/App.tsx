import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { CustomerView } from './components/CustomerView';
import { AdminView } from './components/AdminView';
import { EntryPage } from './components/EntryPage';
import './App.css'
import './styles/theme.css';

// Protected route wrapper for admin
const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { userRole } = useAuth();
  
  if (userRole !== 'admin') {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public entry page */}
        <Route path="/estimate" element={<EntryPage />} />
        
        {/* Public calculator (no auth required) */}
        <Route path="/estimate/calculator" element={<CustomerView />} />
        
        {/* Admin routes (require authentication) */}
        <Route path="/login" element={<Login />} />
        <Route 
          path="/admin" 
          element={
            <ProtectedAdminRoute>
              <AdminView />
            </ProtectedAdminRoute>
          } 
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/estimate" replace />} />
        
        {/* Catch all - redirect to entry page */}
        <Route path="*" element={<Navigate to="/estimate" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

