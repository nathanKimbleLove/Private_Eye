import React, { useState, useEffect } from 'react';

import './Display.css';

const Display = ({ mode, image, emitStartGame, emitStartRound, emitRestart }) => {

  let query;

  let [status, setStatus] = useState(null);
  let [img, setImg] = useState(null);

  const handleStartRound = (e) => {
    e.preventDefault();
    emitStartRound()
  }

  let handleStartGame = (e) => {
    e.preventDefault();
    console.log(query);
    emitStartGame(query);
  }

  const handleRestart = (e) => {
    e.preventDefault();
    emitRestart()
  }

  useEffect(() => {
    console.log(mode, image)
    if (mode === 'startGame') {
      setStatus(
        <form>
          <input type="text" name="query" placeholder="topic" onChange={(e)=>{query=e.target.value}}></input>
          <input type="submit" value="Search for images" onClick={handleStartGame}></input>
        </form>
      )
    } else if (mode === 'waitGame') {
      setStatus(<p>Please wait for the category to be chosen!</p>)
    } else if (mode === 'startRound') {
      setStatus(<button onClick={handleStartRound}>Start Round!</button>)
    } else if (mode === 'waitRound') {
      setStatus(<p>Please wait for the round to begin!</p>)
    } else if (mode === 'inRound') {
      setStatus(<p>Round has begun!</p>)
    } else if (mode === 'restart') {
      setStatus(<button onClick={handleRestart}>New Game!</button>)
    } else if (mode === 'waitRestart') {
      setStatus(<p>Please wait for a new game to be started!</p>)
    }
  }, [mode])

  useEffect(() => {
    if (image) {
      if (typeof image === 'object') {
        setImg(<img src={image.urls.raw} alt={image.alt_description} className="center-fit"></img>);
      } else if (mode === 'waitGame' || mode === 'startGame'){
        setImg(null)
      } else {
        setImg(<p className="liar-text">You are the liar! Blend in on your turn!</p>)
      }
    }
  }, [image, mode])

  return (
    <div className="display">
      {img}
      {status && status}
    </div>
  )
}

export default Display;