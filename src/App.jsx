import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import './index.css'

import MapComponent from './components/MapComponent.jsx';
function App() {
  return (
      <div className="App">
          <h1>Delivery Optimization</h1>
          <MapComponent />
      </div>
  );
}

export default App
