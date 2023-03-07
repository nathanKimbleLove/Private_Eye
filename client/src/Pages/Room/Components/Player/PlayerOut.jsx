import React, { useState, useEffect } from 'react';

import './Player.css';

const PlayerOut = ({ player }) => {

  return (
    <div className="player out">
      {player.nick}
    </div>
  )
}

export default PlayerOut;