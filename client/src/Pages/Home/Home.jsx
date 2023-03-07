import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from "react-router-dom";

import './Home.css';

const Home = ({ socket }) => {
  let navigate = useNavigate();

  let roomId;

  const [nick, setNick] = useState(() => {
    const saved = JSON.parse(JSON.stringify(localStorage.getItem('nick')));
    return saved || '';
  })
  const [nickEntry, setNickEntry] = useState(nick);

  const nameNick = (e) => {
    if (e.key === 'Enter') {
      localStorage.setItem('nick', nickEntry);
      setNick(JSON.parse(JSON.stringify(localStorage.getItem('nick'))));
      setNickEntry(localStorage.getItem('nick'))
    } else {
      setNickEntry(e.target.value);
    }
  }

  const addRoom = (e) => {
    e.preventDefault();
    socket.emit('newRoom', nick);
  }

  const updateRoom = (e) => {
    e.preventDefault();
    roomId = e.target.value;
  }

  const joinRoom = (e) => {
    e.preventDefault();
    socket.emit('joinRoom', roomId, nick);
  }


  socket.on('roomData', (data) => {
    console.log('received ', data);
    navigate(`/${data.id}`, {state: data})
  });


  return (
    <div className="home">
      <div className="rooms-control">
        {nick &&
          <>
            <button onClick={addRoom} className="create-room">Create a Room</button>
            <form>
              <input type="text" onChange={updateRoom} placeholder="Enter Room Code."></input>
              <button onClick={joinRoom}>Join Room</button>
            </form>
          </>
        }
        <input type="text" placeholder='choose a nickname' defaultValue={nick || ''} onKeyUp={nameNick} ></input>
      </div>
    </div>
  )
}

export default Home;