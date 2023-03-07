import React from 'react';
import { Routes, Route } from "react-router-dom";

import { io } from 'socket.io-client'
const socket = io('ws://localhost:3005');

import Home from './Pages/Home/Home.jsx';
import Room from './Pages/Room/Room.jsx';

const App = () => {

return (
  <Routes >
    <Route path="/" element={<Home socket={socket} />} />
    <Route path="/:roomId" element={<Room socket={socket} />} />
  </Routes>
)
}

export default App;