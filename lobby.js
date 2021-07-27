const version = "v1_0_11";

class LobbyModel extends Croquet.Model {
  init(options = {}) {
    super.init(options);
    this.users = new Map(); // lobby session user id => room id, so that everyone can lower that count in the lobby when they go offline
    this.rooms = new Map(); // room name => concurrency count, for display (and for removing when it goes to zero)
    this.subscribe(this.sessionId, 'view-join', this.join);
    this.subscribe(this.sessionId, 'view-exit', this.exit);
    this.subscribe(this.sessionId, 'updateModel', this.updateModel);      
  }
  updateModel({userId, roomId}) {
    const oldRoomId = this.users.get(userId);
    if (oldRoomId) {
      if (this.adjustRoom(oldRoomId, -1) <= 0) {
        this.rooms.delete(oldRoomId);
      }
    }
    if (roomId) {
      this.users.set(userId, roomId);
      this.adjustRoom(roomId, 1);
    } else { // Back to lobby.
      this.users.delete(userId); // Clean up users dictionary.
    }
    this.publish(this.sessionId, 'updateDisplay');
  }
  adjustRoom(roomId, increment = 1) {
    let count = this.rooms.get(roomId) || 0;
    count += increment;
    this.rooms.set(roomId, count);
    return count;
  }
  join(userId) { // Everyone enters through Lobby.
    this.updateModel({userId});
  }
  exit(userId) { // Completely exiting the browser tab, from the lobby or any room.
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
    const templateContent = roomListTemplate.content;
    while (roomList.firstChild) { // roomList.innerHTML = '' would not remove event handlers.
      roomList.removeChild(roomList.firstChild);
    }
    for (let [name, concurrency] of this.model.rooms) { // TODO: keep this stable instead of flashing during changes. (Add or remove only as needed, and update concurrency.)
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
    if (!this.roomSession) return; // old message from an earlier session.
    this.roomSession.leave();
    delete this.roomSession;
    this.publish(this.sessionId, 'updateModel', {userId: this.viewId});        
    this.lobby.classList.remove('hidden');
    this.roomElement.remove();
  }
  async enterRoom(roomId) {
    this.publish(this.sessionId, 'updateModel', {userId: this.viewId, roomId});
    this.lobby.classList.add('hidden');
    // Easist way to maintain rooms is to rebuild them as needed.
    let room = this.roomElement = roomTemplate.content.cloneNode(true).firstElementChild;
    document.body.append(room);
    document.getElementById('return').onclick = () => this.returnToLobby();
    document.getElementById('roomLabel').innerHTML = roomId;
    this.roomSession = await joinRoom(roomId);
    location.hash = encodeURIComponent(roomId) || '';
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
}).then(lobbySession => location.hash && (location.hash !== '#') &&
        lobbySession.view.enterRoom(decodeURIComponent(location.hash.replace(/^#/, ''))));

