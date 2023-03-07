const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {cors:{origin:'*'}});
const path = require('path');
const axios = require('axios');
const env = require('dotenv').config({})
const cors = require('cors');
const port = 3005;

const Game = require('./models.js').Game;
const Player = require('./models.js').Player;

app.get('/bundle.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, '../client/public/bundle.js'));
})

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
})

// app.use(express.static(path.join(__dirname, '../client/public')))
app.use(cors());
app.use(express.json());

let games = {};

io.on('connection', socket => {
  console.log('connection made')

  socket.on('newRoom', (nick) => {
    console.log('received newRoom event!', socket.id);
    let roomCode = socket.id.slice(0, 6)
    //emit roomCode, choose, liar, image data,
    games[roomCode] = new Game(roomCode);
    let host = new Player(socket.id, nick);
    games[roomCode].players.host = host;
    games[roomCode].players.out.push(host);
    socket.join(roomCode);

    socket.emit('roomData', games[roomCode]);
  })

  socket.on('joinRoom', (roomCode, nick) => {
    console.log('received joinRoom event!', roomCode);
    if (games[roomCode]) {
      let player = new Player(socket.id, nick);
      games[roomCode].players.out.push(player)
    } else {
      //do stuff
    }
    socket.join(roomCode);
    socket.emit('roomData', games[roomCode]);
    socket.to(roomCode).emit('updatePlayers', games[roomCode].players);
    io.in(roomCode).emit('notif', { message: `${nick} has joined the game`, id: Date.now(), isNotif: true })
  })

  socket.on('startGame', (query, roomCode) => {

    const g = games[roomCode];
    axios.get(`https://api.unsplash.com/search/photos/?query=${query}`, {headers: {Authorization: process.env.AUTH}})
    .then(resp => {
      return resp.data;
    })
    .then(ans => {
      if(ans) {
        console.log(ans);
        g.image = ans.results[0];
        g.round += .5;
        g.players.in = [...g.players.in, ...g.players.out];
        g.players.out = [];
        let rand = Math.floor(Math.random() * g.players.in.length);
        g.players.liar = g.players.in[rand];

        io.in(roomCode).emit('roomData', g);
      }
    })
    .catch(err => console.log(err))
  })

  socket.on('startRound', roomCode => {

    console.log('received startRound');
    const g = games[roomCode]
    g.round+= .5;
    io.in(roomCode).emit('roomData', g);

    startRound(roomCode)
    .then(ans => startVote(roomCode))
    .then(ans => tallyVote(roomCode))
    .then(vote => sendVoteAndNew(roomCode, vote))
  })

  socket.on('vote', (voteeId, roomCode) => {
    console.log('received a vote');
    let voter = games[roomCode].findPlayer(socket.id);
    let votee = games[roomCode].findPlayer(voteeId);
    if (voter && votee) {
      let v = games[roomCode].vote
      v[voteeId] ? v[voteeId]++ : v[voteeId] = 1;
    }
  })

  socket.on('restart', (roomCode) => {
    const g = games[roomCode];
    console.log('received a command to restart', games[roomCode]);
    g.round = 0;
    g.players.out = [...g.players.in, g.players.out];
    g.players.in = [];
    g.players.liar = null;
    g.players.turn = null;
    g.image = null;

    io.in(roomCode).emit('roomData', g);
  })

  // MESSAGES
  socket.on('message', (message, roomCode) => {
    console.log('received message event', message, roomCode);
    let playerIn = games[roomCode].findPlayer(socket.id)
    let msg = {
      message: message,
      user: socket.id,
      username: playerIn ? playerIn.nick : games[roomCode].findPlayerFromOut(socket.id).nick,
      userStatus: playerIn ? 'in' : 'out',
      id: Date.now()
    }
    if ((games[roomCode].players.turn && games[roomCode].players.turn.id === socket.id) || games[roomCode].chat === 'open' || !playerIn) {
      console.log('(in and (turn or open)) or out');
      io.in(roomCode).emit('message', msg);
    } else if (playerIn) {
      console.log('in but not turn or open');
      socket.emit('notif', { message: `It isn't your turn!`,id: Date.now(),isNotif: true })
    }
  })

})

http.listen(port, () => console.log(`listenin on prot ${port}`));

const startRound = (roomCode) => {
  let players = games[roomCode].players.in;
  games[roomCode].chat = 'closed';

  createRandomOrder(players);

  let i = 0;
  let intervalId;
  return new Promise((res, rej) => {
    intervalId = setInterval(() => {
      // set players.turn to next player
      // send message that it is player's turn
      console.log('new interval', i);
      if (i < players.length) {
        games[roomCode].players.turn = players[i];
        io.in(roomCode).emit('notif', { message: `It is ${players[i].nick}'s turn`, id: Date.now(), isNotif:true });
      }
      i++;
      if (i === players.length + 1) {
        clearInterval(intervalId);
        res('hoorah');
      }
    }, 10000)
  })
}
const startVote = (roomCode) => {
  console.log('=== starting vote ===');
  games[roomCode].round = games[roomCode].round;
  games[roomCode].chat = 'open';
  io.in(roomCode).emit('notif', {message: `Let the voting begin`, id: Date.now(), isNotif: true });
  io.in(roomCode).emit('startVote');
  return new Promise((res, rej) => {
    setTimeout(() => {
      io.in(roomCode).emit('notif', {message: `Voting is over!`, id: Date.now(), isNotif: true});
      io.in(roomCode).emit('endVote');
      res('hoorah');
    }, 10000);
  })
}
const tallyVote = (roomCode) => {
  console.log('=== tallying vote ===, currVoteData: ', games[roomCode].vote);
  let v = games[roomCode].vote;
  let keys = Object.keys(v);
  let largest = {
    count: 0,
    players : [],
    win: null,
    liar: false
  };
  for (let i = 0; i < keys.length; i++) {
    if (v[keys[i]] > largest.count) {
      console.log('v[keys[i]] is greater than largest.count');
      largest.count = v[keys[i]]
      largest.players = [keys[i]];
    } else if (v[keys[i]] === largest.count) {
      console.log('v[keys[i]] is equal to largest.count');
      largest.players.push(keys[i]);
    }
  }

  if (largest.players.length === 1) {
    if (largest.players[0] === games[roomCode].players.liar.id) {
      console.log('you are here')
      largest.liar = true;
    }
  } else {
    largest.players = null;
  }
  return largest;
}
const sendVoteAndNew = (roomCode, vote) => {
  console.log('=== setting vote and giving new and stuff ===')

  const g = games[roomCode]
  let liarFound = false;
  //change room data
  if (vote.liar) {
    console.log('the liar was voted for', vote);
    g.round = 100;
    liarFound = true;
    io.in(roomCode).emit('voteResult', `The Detectives Win! \n (${g.players.liar.nick} was the liar)`);
  } else if (vote.players) {
    console.log('the liar was not voted for, voteData: ', vote);
    g.round += .5;
    g.movePlayer(vote.players[0]);
  } else /* vote is null */ {
    console.log('there was a tie or something, idk, the vote was null when it got to me', vote);
    g.round += .5;
    io.in(roomCode).emit('voteResult', `No one was eliminated.`);
  }
  if (g.players.in.length < 3 && !liarFound) {
    console.log('the liar was voted for', vote);
    g.round = 100;
    io.in(roomCode).emit('voteResult', `The Liar Wins! \n (${g.players.liar.nick} was the liar)`);
  }
  g.players.turn = null;
  g.vote = {};
  io.in(roomCode).emit('roomData', g);
}

const createRandomOrder = (array) => {
//Durstenfeld JS Implementation
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

const checkIfIn = (socketId, roomCode) => {
  let temp = games[roomCode].players.in;

  for (let i = 0; i < temp.length; i++) {
    if (temp[i].id === socketId) return true;
  }
  return false;
}


// tste data
let testData = {
  "total": 4044,
  "total_pages": 405,
  "results": [
    {
      "id": "Z05GiksmqYU",
      "created_at": "2018-10-26T17:00:04Z",
      "updated_at": "2023-02-26T20:05:23Z",
      "promoted_at": null,
      "width": 4928,
      "height": 3264,
      "color": "#26260c",
      "blur_hash": "LJEybwQ?KdnU?t$,I-RR0KoyR5R+",
      "description": null,
      "alt_description": "brown coated monkey on branch",
      "urls": {
        "raw": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?ixid=Mnw0MTYyMTl8MHwxfHNlYXJjaHwxfHxtb25rZXlzfGVufDB8fHx8MTY3NzUyNjM3Ng&ixlib=rb-4.0.3",
        "full": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?crop=entropy&cs=tinysrgb&fm=jpg&ixid=Mnw0MTYyMTl8MHwxfHNlYXJjaHwxfHxtb25rZXlzfGVufDB8fHx8MTY3NzUyNjM3Ng&ixlib=rb-4.0.3&q=80",
        "regular": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=Mnw0MTYyMTl8MHwxfHNlYXJjaHwxfHxtb25rZXlzfGVufDB8fHx8MTY3NzUyNjM3Ng&ixlib=rb-4.0.3&q=80&w=1080",
        "small": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=Mnw0MTYyMTl8MHwxfHNlYXJjaHwxfHxtb25rZXlzfGVufDB8fHx8MTY3NzUyNjM3Ng&ixlib=rb-4.0.3&q=80&w=400",
        "thumb": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=Mnw0MTYyMTl8MHwxfHNlYXJjaHwxfHxtb25rZXlzfGVufDB8fHx8MTY3NzUyNjM3Ng&ixlib=rb-4.0.3&q=80&w=200",
        "small_s3": "https://s3.us-west-2.amazonaws.com/images.unsplash.com/small/photo-1540573133985-87b6da6d54a9"
      },
      "links": {
          "self": "https://api.unsplash.com/photos/Z05GiksmqYU",
          "html": "https://unsplash.com/photos/Z05GiksmqYU",
          "download": "https://unsplash.com/photos/Z05GiksmqYU/download?ixid=Mnw0MTYyMTl8MHwxfHNlYXJjaHwxfHxtb25rZXlzfGVufDB8fHx8MTY3NzUyNjM3Ng",
          "download_location": "https://api.unsplash.com/photos/Z05GiksmqYU/download?ixid=Mnw0MTYyMTl8MHwxfHNlYXJjaHwxfHxtb25rZXlzfGVufDB8fHx8MTY3NzUyNjM3Ng"
        },
      "likes": 599,
      "liked_by_user": false,
      "current_user_collections": [],
      "sponsorship": null,
      "topic_submissions": {},
      "user": {
          "id": "g_vlCe1I-Pw",
          "updated_at": "2023-02-25T11:15:52Z",
          "username": "haughters",
          "name": "Jamie Haughton",
          "first_name": "Jamie",
          "last_name": "Haughton",
          "twitter_username": "haughters",
          "portfolio_url": null,
          "bio": null,
          "location": null,
          "links": {
              "self": "https://api.unsplash.com/users/haughters",
              "html": "https://unsplash.com/@haughters",
              "photos": "https://api.unsplash.com/users/haughters/photos",
              "likes": "https://api.unsplash.com/users/haughters/likes",
              "portfolio": "https://api.unsplash.com/users/haughters/portfolio",
              "following": "https://api.unsplash.com/users/haughters/following",
              "followers": "https://api.unsplash.com/users/haughters/followers"
            },
          "profile_image": {
              "small": "https://images.unsplash.com/profile-1668074549999-892433bf5f3eimage?ixlib=rb-4.0.3&crop=faces&fit=crop&w=32&h=32",
              "medium": "https://images.unsplash.com/profile-1668074549999-892433bf5f3eimage?ixlib=rb-4.0.3&crop=faces&fit=crop&w=64&h=64",
              "large": "https://images.unsplash.com/profile-1668074549999-892433bf5f3eimage?ixlib=rb-4.0.3&crop=faces&fit=crop&w=128&h=128"
            },
          "instagram_username": "haughters",
          "total_collections": 0,
          "total_likes": 293,
          "total_photos": 27,
          "accepted_tos": true,
          "for_hire": false,
          "social": {
              "instagram_username": "haughters",
              "portfolio_url": null,
              "twitter_username": "haughters",
              "paypal_email": null
            }
        },
      "tags": [
            {
              "type": "landing_page",
              "title": "animal",
              "source": {
                  "ancestry": {
                      "type": {
                          "slug": "images",
                          "pretty_slug": "Images"
                        },
                      "category": {
                          "slug": "animals",
                          "pretty_slug": "Animals"
                        }
                    },
                  "title": "Animals images & pictures",
                  "subtitle": "Download free animals images",
                  "description": "Passionate photographers have captured the most gorgeous animals in the world in their natural habitats and shared them with Unsplash. Now you can use these photos however you wish, for free!",
                  "meta_title": "Best 20+ Animals Pictures [HD] | Download Free Images on Unsplash",
                  "meta_description": "Choose from hundreds of free animals pictures. Download HD animals photos for free on Unsplash.",
                  "cover_photo": {
                      "id": "YozNeHM8MaA",
                      "created_at": "2017-04-18T17:00:04Z",
                      "updated_at": "2023-02-18T05:01:27Z",
                      "promoted_at": "2017-04-19T17:54:55Z",
                      "width": 5184,
                      "height": 3456,
                      "color": "#f3f3c0",
                      "blur_hash": "LPR{0ext~pIU%MRQM{%M%LozIBM|",
                      "description": "I met this dude on safari in Kruger National park in northern South Africa. The giraffes were easily in my favorite creatures to witness. They seemed almost prehistoric the the way the graced the African plain.",
                      "alt_description": "selective focus photography of giraffe",
                      "urls": {
                          "raw": "https://images.unsplash.com/photo-1492534513006-37715f336a39?ixlib=rb-4.0.3",
                          "full": "https://images.unsplash.com/photo-1492534513006-37715f336a39?ixlib=rb-4.0.3&q=80&cs=tinysrgb&fm=jpg&crop=entropy",
                          "regular": "https://images.unsplash.com/photo-1492534513006-37715f336a39?ixlib=rb-4.0.3&w=1080&fit=max&q=80&fm=jpg&crop=entropy&cs=tinysrgb",
                          "small": "https://images.unsplash.com/photo-1492534513006-37715f336a39?ixlib=rb-4.0.3&w=400&fit=max&q=80&fm=jpg&crop=entropy&cs=tinysrgb",
                          "thumb": "https://images.unsplash.com/photo-1492534513006-37715f336a39?ixlib=rb-4.0.3&w=200&fit=max&q=80&fm=jpg&crop=entropy&cs=tinysrgb",
                          "small_s3": "https://s3.us-west-2.amazonaws.com/images.unsplash.com/small/photo-1492534513006-37715f336a39"
                        },
                      "links": {
                          "self": "https://api.unsplash.com/photos/YozNeHM8MaA",
                          "html": "https://unsplash.com/photos/YozNeHM8MaA",
                          "download": "https://unsplash.com/photos/YozNeHM8MaA/download",
                          "download_location": "https://api.unsplash.com/photos/YozNeHM8MaA/download"
                        },
                      "likes": 1519,
                      "liked_by_user": false,
                      "current_user_collections": [],
                      "sponsorship": null,
                      "topic_submissions": {
                          "animals": {
                              "status": "approved",
                              "approved_on": "2021-06-09T15:10:40Z"
                            }
                        },
                      "premium": false,
                      "user": {
                          "id": "J6cg9TA8-e8",
                          "updated_at": "2023-02-18T10:16:17Z",
                          "username": "judahlegge",
                          "name": "Judah Legge",
                          "first_name": "Judah",
                          "last_name": "Legge",
                          "twitter_username": null,
                          "portfolio_url": null,
                          "bio": null,
                          "location": null,
                          "links": {
                              "self": "https://api.unsplash.com/users/judahlegge",
                              "html": "https://unsplash.com/@judahlegge",
                              "photos": "https://api.unsplash.com/users/judahlegge/photos",
                              "likes": "https://api.unsplash.com/users/judahlegge/likes",
                              "portfolio": "https://api.unsplash.com/users/judahlegge/portfolio",
                              "following": "https://api.unsplash.com/users/judahlegge/following",
                              "followers": "https://api.unsplash.com/users/judahlegge/followers"
                            },
                          "profile_image": {
                              "small": "https://images.unsplash.com/profile-fb-1492532922-001f65e39343.jpg?ixlib=rb-4.0.3&crop=faces&fit=crop&w=32&h=32",
                              "medium": "https://images.unsplash.com/profile-fb-1492532922-001f65e39343.jpg?ixlib=rb-4.0.3&crop=faces&fit=crop&w=64&h=64",
                              "large": "https://images.unsplash.com/profile-fb-1492532922-001f65e39343.jpg?ixlib=rb-4.0.3&crop=faces&fit=crop&w=128&h=128"
                            },
                          "instagram_username": null,
                          "total_collections": 0,
                          "total_likes": 4,
                          "total_photos": 1,
                          "accepted_tos": false,
                          "for_hire": false,
                          "social": {
                              "instagram_username": null,
                              "portfolio_url": null,
                              "twitter_username": null,
                              "paypal_email": null
                            }
                        }
                    }
                }
            },
            {
              "type": "landing_page",
              "title": "monkey",
              "source": {
                  "ancestry": {
                      "type": {
                          "slug": "images",
                          "pretty_slug": "Images"
                        },
                      "category": {
                          "slug": "animals",
                          "pretty_slug": "Animals"
                        },
                      "subcategory": {
                          "slug": "monkey",
                          "pretty_slug": "Monkey"
                        }
                    },
                  "title": "Monkey images",
                  "subtitle": "Download free monkey images",
                  "description": "Our closest ancestors in the animal kingdom deserve respeck, and Unsplash's community of dedicated professional photographers have captured them beautifully in this HUGE collection of monkey images. 100% free to use!",
                  "meta_title": "Best 500+ Monkey Pictures [HD] | Download Free Images & Stock Photos on Unsplash",
                  "meta_description": "Choose from hundreds of free monkey pictures. Download HD monkey photos for free on Unsplash.",
                  "cover_photo": {
                      "id": "Z05GiksmqYU",
                      "created_at": "2018-10-26T17:00:04Z",
                      "updated_at": "2023-02-19T20:41:29Z",
                      "promoted_at": null,
                      "width": 4928,
                      "height": 3264,
                      "color": "#26260c",
                      "blur_hash": "LJEybwQ?KdnU?t$,I-RR0KoyR5R+",
                      "description": null,
                      "alt_description": "brown coated monkey on branch",
                      "urls": {
                          "raw": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?ixlib=rb-4.0.3",
                          "full": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?ixlib=rb-4.0.3&q=80&cs=tinysrgb&fm=jpg&crop=entropy",
                          "regular": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?ixlib=rb-4.0.3&w=1080&fit=max&q=80&fm=jpg&crop=entropy&cs=tinysrgb",
                          "small": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?ixlib=rb-4.0.3&w=400&fit=max&q=80&fm=jpg&crop=entropy&cs=tinysrgb",
                          "thumb": "https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?ixlib=rb-4.0.3&w=200&fit=max&q=80&fm=jpg&crop=entropy&cs=tinysrgb",
                          "small_s3": "https://s3.us-west-2.amazonaws.com/images.unsplash.com/small/photo-1540573133985-87b6da6d54a9"
                        },
                      "links": {
                          "self": "https://api.unsplash.com/photos/Z05GiksmqYU",
                          "html": "https://unsplash.com/photos/Z05GiksmqYU",
                          "download": "https://unsplash.com/photos/Z05GiksmqYU/download",
                          "download_location": "https://api.unsplash.com/photos/Z05GiksmqYU/download"
                        },
                      "likes": 596,
                      "liked_by_user": false,
                      "current_user_collections": [],
                      "sponsorship": null,
                      "topic_submissions": {},
                      "premium": false,
                      "user": {
                          "id": "g_vlCe1I-Pw",
                          "updated_at": "2023-02-19T06:11:52Z",
                          "username": "haughters",
                          "name": "Jamie Haughton",
                          "first_name": "Jamie",
                          "last_name": "Haughton",
                          "twitter_username": "haughters",
                          "portfolio_url": null,
                          "bio": null,
                          "location": null,
                          "links": {
                              "self": "https://api.unsplash.com/users/haughters",
                              "html": "https://unsplash.com/fr/@haughters",
                              "photos": "https://api.unsplash.com/users/haughters/photos",
                              "likes": "https://api.unsplash.com/users/haughters/likes",
                              "portfolio": "https://api.unsplash.com/users/haughters/portfolio",
                              "following": "https://api.unsplash.com/users/haughters/following",
                              "followers": "https://api.unsplash.com/users/haughters/followers"
                            },
                          "profile_image": {
                              "small": "https://images.unsplash.com/profile-1668074549999-892433bf5f3eimage?ixlib=rb-4.0.3&crop=faces&fit=crop&w=32&h=32",
                              "medium": "https://images.unsplash.com/profile-1668074549999-892433bf5f3eimage?ixlib=rb-4.0.3&crop=faces&fit=crop&w=64&h=64",
                              "large": "https://images.unsplash.com/profile-1668074549999-892433bf5f3eimage?ixlib=rb-4.0.3&crop=faces&fit=crop&w=128&h=128"
                            },
                          "instagram_username": "haughters",
                          "total_collections": 0,
                          "total_likes": 292,
                          "total_photos": 27,
                          "accepted_tos": true,
                          "for_hire": false,
                          "social": {
                              "instagram_username": "haughters",
                              "portfolio_url": null,
                              "twitter_username": "haughters",
                              "paypal_email": null
                            }
                        }
                    }
                }
            },
            {
              "type": "search",
              "title": "scare"
            }
        ]
      }
    ]
  }