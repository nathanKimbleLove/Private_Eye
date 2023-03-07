import React from 'react';
import {createRoot} from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
import { BrowserRouter } from "react-router-dom";

import './index.css';
import App from './App.jsx'

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);