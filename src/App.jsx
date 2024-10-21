import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import './index.css';

import MapComponent from './components/MapComponent.jsx';

function App() {
  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-gray-100">
      <header className="w-full p-6 bg-white shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-800">Delivery Optimization</h1>
        
      </header>
      <main className="flex-grow w-full p-4">
        <MapComponent />
      </main>
      <footer className="w-full p-4 bg-white shadow-inner">
        <p className="text-center text-gray-600">
          &copy; {new Date().getFullYear()} Delivery Optimization. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default App;
