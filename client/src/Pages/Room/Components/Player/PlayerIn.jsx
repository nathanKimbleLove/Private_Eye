import React, { useState, useEffect } from 'react';

import './Player.css';

const PlayerIn = ({ player, sendVote }) => {

  const [pl, setPl] = useState();

  const callSendVote = (e) => {
    e.preventDefault();
    let res = sendVote(pl.id);
    if (res) {
      e.target.classList.addClass('selected');
    }
  }

  useEffect(() => {
    if (player) setPl(player);
  }, [player])

  return (
    <div className="player in" onClick={callSendVote}>
      {player.nick}
    </div>
  )
}

export default PlayerIn;