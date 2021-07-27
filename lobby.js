const version = "v1_0_6";

class LobbyModel extends Croquet.Model {
  init(options = {}) {
    super.init(options);
    this.users = {}; // lobby session user id => room id, so that everyone can lower that count in the lobby when they go offline
    this.rooms = {}; // room name => concurrency count, for display (and for removing when it goes to zero)
    this.subscribe(this.sessionId, 'view-join', this.join);
    this.subscribe(this.sessionId, 'view-exit', this.exit);
    this.subscribe(this.sessionId, 'updateModel', this.updateModel);      
  }
  updateModel({userId, roomId}) {
    console.log('fixme LobbyModel.updateModel', userId, roomId);
    const oldRoomId = this.users[userId];
    if (oldRoomId) {
      if (--this.rooms[oldRoomId] <= 0) {
        delete this.rooms[oldRoomId];
      }
    }
    if (roomId) {
      this.users[userId] = roomId;
      this.rooms[roomId] = (this.rooms[roomId] || 0) + 1;
    } else { // Back to lobby.
      delete this.users[userId]; // Clean up users dictionary.
    }
    this.publish(this.sessionId, 'updateDisplay');
  }
  join(userId) { // Everyone enters through Lobby.
    console.log('fixme LobbyModel.join', userId);
    this.updateModel({userId});
  }
  exit(userId) { // Completely exiting the browser tab, from the lobby or any room.
    console.log('fixme LobbyModel.exit', userId);    
    this.updateModel({userId});
  }
}
LobbyModel.register("LobbyModel");

class LobbyUI extends Croquet.View {
  constructor(model) {
    super(model);
    this.lobby = document.querySelector('lobby');
    this.model = model;
    this.subscribe(this.sessionId, 'updateDisplay', this.updateDisplay);
    makeRoomButton.onclick = () => this.enterRoom(newRoomName.value); // No need to make it, just enter.
  }
  updateDisplay() {
    const templateContent = roomListTemplate.content,
          rooms = this.model.rooms,
          names = Object.keys(rooms).reverse(); // Let's list the newest first.
    console.log('fixme updateDisplay',  names, JSON.stringify(rooms));
    while (roomList.firstChild) { // roomList.innerHTML = '' would not remove event handlers.
      roomList.removeChild(roomList.firstChild);
    }
    for (let name of names) { // TODO: keep this stable instead of flashing during changes. (Add or remove only as needed, and update concurrency.)
      let concurrency = rooms[name];
      console.log(name, concurrency);
      if (!concurrency) break;
      let item = templateContent.cloneNode(true).firstElementChild,
          link = item.getElementsByTagName('a')[0];
      link.innerText = name;
      link.onclick = () => this.enterRoom(name);
      item.getElementsByTagName('concurrency')[0].innerText = concurrency;
      roomList.append(item);
    }
  }
  returnToLobby() {
    console.log('fixme returnToLobby', this.roomSession);
    if (!this.roomSession) return; // old message from an earlier session.
    this.roomSession.leave();
    delete this.roomSession;
    this.publish(this.sessionId, 'updateModel', {userId: this.viewId});        
    this.lobby.classList.remove('hidden');
    this.roomElement.remove();
  }
  async enterRoom(roomId) {
    console.log('fixme enterRoom', roomId);
    this.publish(this.sessionId, 'updateModel', {userId: this.viewId, roomId});
    this.lobby.classList.add('hidden');
    // Easist way to maintain rooms is to rebuild them as needed.
    let room = this.roomElement = roomTemplate.content.cloneNode(true).firstElementChild;
    document.body.append(room);
    document.getElementById('return').onclick = () => this.returnToLobby();
    document.getElementById('roomLabel').innerHTML = roomId;
    this.roomSession = await joinRoom(roomId);
    console.log('fixme entered room', roomId, 'session', this.roomSession);
  }
}

Croquet.Session.join({  // Join the lobby session, which we will be part of the whole time. (Low traffic.)
  appId: "com.highfidelity.popupbbs." + version,
  name: "lobby",
  password: "none",
  model: LobbyModel,
  autoSleep: false,
  tps: 2,
  view: LobbyUI
});

