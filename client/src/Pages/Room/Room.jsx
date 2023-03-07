import React, { useState, useEffect } from 'react';
import { Link, useLocation } from "react-router-dom";
import axios from 'axios';

import './Room.css';
import Chat from './Components/Chat/Chat.jsx';
import Display from './Components/Display/Display.jsx';
import Scoreboard from './Components/Scoreboard/Scoreboard.jsx';

const Room = ({ socket }) => {

  let location = useLocation();

  const nick = JSON.parse(JSON.stringify(localStorage.getItem('nick')));

  let [query, setQuery] = useState('');
  let [right, setRight] = useState(null);
  let [image, setImage] = useState(null);
  let [mode, setMode] = useState(null);
  let [players, setPlayers] = useState(null);
  let [roomCode, setRoomCode] = useState(null);
  let [vote, setVote] = useState(false);
  let [voteData, setVoteData] = useState(false);
  let [amIn, setAmIn] = useState(false);

  const emitStartRound = () => socket.emit('startRound', roomCode);
  const emitStartGame = (query) => socket.emit('startGame', query, roomCode);
  const emitRestart = () => socket.emit('restart', roomCode);

  useEffect(() => {
    if (location) setStates(location.state);
  }, [location]);

  socket.on('roomData', data => setStates(data));

  const setStates = ({id, round, image, players}) => {
    console.log('received ', round, image, players);
    //REFACTOR ???
    if (players.liar && players.liar.id !== socket.id) setImage(image);
    else setImage('liar-text')
    if (round === 0) {
      if (players.host.id === socket.id) setMode('startGame');
      else setMode('waitGame');
    } else if (round % 1 === .5) {
      if (players.host.id === socket.id) setMode('startRound');
      else setMode('waitRound');
    } else if (round === 100) {
      if (players.host.id === socket.id) setMode('restart');
      else setMode('waitRestart');
      if (players.liar.id === socket.id) setImage(image);
    } else if (round % 1 === 0) {
      setMode('inRound');
    }
    setRoomCode(id);
    setPlayers(players);

    let isIn = false;
    for (let i = 0; i < players.in.length; i++) {
      if (players.in[i].id === socket.id) {
        isIn = true;
        break;
      }
    }
    setAmIn(isIn)
  }

  return (
    <div className="room">
      <Chat socket={socket} roomCode={roomCode} amIn={amIn}/>
      <div className="right-side">
        <Display mode={mode} image={image} emitStartGame={emitStartGame} emitStartRound={emitStartRound} emitRestart={emitRestart}/>
        <Scoreboard socket={socket} players={players} roomCode={roomCode} voteData={voteData}/>
      </div>
    </div>
  )
}

export default Room;