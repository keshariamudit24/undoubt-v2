import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
	return (
		<AuthProvider>
			<Router>
				<Routes>
					<Route path="/" element={<Landing />} />
					<Route
						path="/dashboard"
						element={
							<ProtectedRoute>
								<Dashboard />
							</ProtectedRoute>
						}
					/>
				</Routes>
			</Router>
			<Toaster
				position="top-center"
				toastOptions={{
					duration: 4000,
					style: {
						background: '#18181b', // zinc-900
						color: '#f4f4f5', // zinc-100
						border: '1px solid #3f3f46', // zinc-700
						borderRadius: '12px',
						fontSize: '14px',
						fontWeight: '500',
					},
					success: {
						iconTheme: {
							primary: '#22d3ee', // cyan-400
							secondary: '#18181b',
						},
					},
					error: {
						iconTheme: {
							primary: '#ef4444', // red-500
							secondary: '#18181b',
						},
					},
				}}
			/>
		</AuthProvider>
	);
}
