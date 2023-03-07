var Game = function(id) {
  this.id = id;
  this.round = 0;
  this.image = null;
  this.chat = 'open';
  this.vote = {};
  this.players = {
    liar: null,
    host: null,
    turn: null,
    in: [],
    out: []
  }
}

Game.prototype.addPlayer = function(player) {
  this.players.out.push(player);
}

Game.prototype.removePlayer = function(playerId) {
  for (let i = 0; i < this.players.in.length; i++) {
    if (this.players.in[i].id === playerId) {
      this.players.in[i] = this.players.in[this.players.in.length - 1]
      this.players.in.pop();
      break;
    }
  }
  for (let i = 0; i < this.players.out.length; i++) {
    if (this.players.out[i].id === playerId) {
      this.players.out[i] = this.players.out[this.players.out.length - 1]
      this.players.out.pop();
      break;
    }
  }

  if (this.players.liar.id === playerId) {
    return 0;
  } else if (this.players.host.id === playerId) {
    return 1;
  } else if (this.players.in.length === 0 && this.players.out.length === 0) {
    return 2;
  }
}

Game.prototype.findPlayer = function(playerId, cb) {
  for (let i = 0; i < this.players.in.length; i++) {
    if (this.players.in[i].id === playerId) {
      if (!cb) {
        return this.players.in[i];
      } else {
        cb(this.players.in[i]);
        return;
      }
    }
  }
  if(cb) cb(null);
}

Game.prototype.findPlayerFromOut = function(playerId, cb) {
  for (let i = 0; i < this.players.out.length; i++) {
    if (this.players.out[i].id === playerId) {
      if (!cb) {
        return this.players.out[i];
      } else {
        cb(this.players.out[i]);
        return;
      }
    }
  }
  if(cb) cb(null);
}

Game.prototype.movePlayer = function(playerId) {
  let temp;
  for (let i = 0; i < this.players.in.length; i++) {
    if (this.players.in[i].id === playerId) {
      temp = this.players.in[i];
      this.players.in[i] = this.players.in[this.players.in.length - 1]
      this.players.in.pop();
    }
  }
  this.players.out.push(temp);
}


var Player = function(id, nick = null) {
  this.id = id;
  this.nick = nick;
}


module.exports = {
  Game: Game,
  Player: Player
}