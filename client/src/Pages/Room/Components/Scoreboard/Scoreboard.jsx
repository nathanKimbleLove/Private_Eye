import React, { useState, useEffect } from 'react';

import './Scoreboard.css';
import PlayerIn from '../Player/PlayerIn.jsx';
import PlayerOut from '../Player/PlayerOut.jsx';

const Scoreboard = ({ socket, players, roomCode, voteData }) => {

  let [vote, setVote] = useState(false);
  let [plsIn, setPlsIn] = useState(null);
  let [plsOut, setPlsOut] = useState(null);
  let [voteSent, setVoteSent] = useState(false);

  socket.on('updatePlayers', (playersReceived) => {
    setPlsIn(playersReceived.in);
    setPlsOut(playersReceived.out);
  })
  socket.on('startVote', () => setVote(true));
  socket.on('endVote', () => {
    setVote(false);
    setVoteSent(false);
  });

  const sendVote = (id) => {
    if (vote && !voteSent) {
      let confirmation = confirm('Votes are final! \nIs this who you would like to vote for?');
      if (confirmation) {
        socket.emit('vote', id, roomCode);
        setVoteSent(true);
        return true;
      }
    }
  }

  const findSelfIn = () => {
    for (let i = 0; i < plsIn.length; i++) {
      if (plsIn[i].id === socket.id) {
        return true;
      }
    }
    return false;
  }

  useEffect(() => {
    console.log('players', players);
    if (players) {
      setPlsIn(players.in);
      setPlsOut(players.out);
    }
  }, [players])

  return (
    <div className="scoreboard">
      {plsIn &&
      <div className="players-in">
         {plsIn.map(pl => <PlayerIn player={pl} key={pl.id} sendVote={sendVote} />)}
      </div>
      }
      {plsOut &&
      <div className="players-out">
        {plsOut.map(pl => <PlayerOut player={pl} key={pl.id} />)}
      </div>
      }
    </div>
  )
}

export default Scoreboard;