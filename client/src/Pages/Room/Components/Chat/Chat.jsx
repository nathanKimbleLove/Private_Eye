import React, { useState, useEffect } from 'react';

import './Chat.css';
import Message from '../Message/Message.jsx';

const Chat = ({ socket, roomCode, amIn }) => {

  let [messages, setMessages] = useState([]);

  const handleEnter = (e) => {
    if (e.key === 'Enter') {
      console.log(e.target.value);
      socket.emit('message', e.target.value, roomCode)
    }
  }

  socket.on('message', (message) => {
    console.log('received a message');
    if(message.userStatus === 'in' || !amIn)
    setMessages([...messages, message]);
  })

  socket.on('notif', (notif) => {
    console.log('received a notif');
    setMessages([...messages, notif]);
  })


  return (
    <div className="sidebar">
      <div className="room-id">
        <h2>{roomCode}</h2>
      </div>
      <div className="chat">
        <div className="messages">
          {messages[0] ? messages.map((el) => <Message data={el} key={el.id}/>) : null }
        </div>
        <input type="text" onKeyDown={handleEnter}></input>
      </div>
    </div>
  )
}

export default Chat;