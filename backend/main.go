// package main

// import (
// 	"database/sql"
// 	"encoding/json"
// 	"log"
// 	"net/http"
// 	"sync"
// 	"time"

// 	"github.com/gorilla/websocket"
// 	_ "github.com/mattn/go-sqlite3"
// )

// // Message types for WebSocket communication
// type MessageType string

// const (
// 	JoinRoom     MessageType = "join_room"
// 	LeaveRoom    MessageType = "leave_room"
// 	Offer        MessageType = "offer"
// 	Answer       MessageType = "answer"
// 	ICECandidate MessageType = "ice_candidate"
// 	UserJoined   MessageType = "user_joined"
// 	UserLeft     MessageType = "user_left"
// 	Error        MessageType = "error"
// )

// // WebSocket message structure
// type Message struct {
// 	Type     MessageType     `json:"type"`
// 	RoomID   string          `json:"room_id,omitempty"`
// 	UserID   string          `json:"user_id,omitempty"`
// 	TargetID string          `json:"target_id,omitempty"`
// 	Data     json.RawMessage `json:"data,omitempty"`
// }

// // Client represents a WebSocket connection
// type Client struct {
// 	ID     string
// 	Conn   *websocket.Conn
// 	RoomID string
// 	Send   chan Message
// 	Server *Server
// }

// // Room represents a voice chat room
// type Room struct {
// 	ID      string
// 	Clients map[string]*Client
// 	Mutex   sync.RWMutex
// }

// // Server manages all connections and rooms
// type Server struct {
// 	Clients    map[string]*Client
// 	Rooms      map[string]*Room
// 	Register   chan *Client
// 	Unregister chan *Client
// 	Broadcast  chan Message
// 	Mutex      sync.RWMutex
// 	DB         *sql.DB
// }

// var upgrader = websocket.Upgrader{
// 	CheckOrigin: func(r *http.Request) bool {
// 		return true // Allow all origins for demo
// 	},
// 	ReadBufferSize:  1024,
// 	WriteBufferSize: 1024,
// }

// func NewServer() *Server {
// 	db, err := sql.Open("sqlite3", ":memory:")
// 	if err != nil {
// 		log.Fatal("Failed to open database:", err)
// 	}

// 	// Create rooms table
// 	_, err = db.Exec(`
// 		CREATE TABLE IF NOT EXISTS rooms (
// 			id TEXT PRIMARY KEY,
// 			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
// 			user_count INTEGER DEFAULT 0
// 		)
// 	`)
// 	if err != nil {
// 		log.Fatal("Failed to create rooms table:", err)
// 	}

// 	return &Server{
// 		Clients:    make(map[string]*Client),
// 		Rooms:      make(map[string]*Room),
// 		Register:   make(chan *Client),
// 		Unregister: make(chan *Client),
// 		Broadcast:  make(chan Message),
// 		DB:         db,
// 	}
// }

// func (s *Server) Run() {
// 	for {
// 		select {
// 		case client := <-s.Register:
// 			s.Mutex.Lock()
// 			s.Clients[client.ID] = client
// 			s.Mutex.Unlock()
// 			log.Printf("Client %s connected", client.ID)

// 		case client := <-s.Unregister:
// 			s.Mutex.Lock()
// 			if _, ok := s.Clients[client.ID]; ok {
// 				delete(s.Clients, client.ID)
// 				close(client.Send)
				
// 				// Remove from room
// 				if client.RoomID != "" {
// 					s.removeFromRoom(client)
// 				}
// 			}
// 			s.Mutex.Unlock()
// 			log.Printf("Client %s disconnected", client.ID)

// 		case message := <-s.Broadcast:
// 			s.handleMessage(message)
// 		}
// 	}
// }

// func (s *Server) handleMessage(msg Message) {
// 	switch msg.Type {
// 	case JoinRoom:
// 		s.handleJoinRoom(msg)
// 	case LeaveRoom:
// 		s.handleLeaveRoom(msg)
// 	case Offer, Answer, ICECandidate:
// 		s.handleSignaling(msg)
// 	}
// }

// func (s *Server) handleJoinRoom(msg Message) {
// 	s.Mutex.Lock()
// 	defer s.Mutex.Unlock()

// 	client, exists := s.Clients[msg.UserID]
// 	if !exists {
// 		return
// 	}

// 	// Remove from current room if any
// 	if client.RoomID != "" {
// 		s.removeFromRoom(client)
// 	}

// 	// Get or create room
// 	room, exists := s.Rooms[msg.RoomID]
// 	if !exists {
// 		room = &Room{
// 			ID:      msg.RoomID,
// 			Clients: make(map[string]*Client),
// 		}
// 		s.Rooms[msg.RoomID] = room
		
// 		// Insert room into database
// 		s.DB.Exec("INSERT OR REPLACE INTO rooms (id, user_count) VALUES (?, ?)", 
// 			msg.RoomID, 0)
// 	}

// 	// Check room capacity (max 2 for P2P)
// 	if len(room.Clients) >= 2 {
// 		client.Send <- Message{
// 			Type: Error,
// 			Data: json.RawMessage(`{"message": "Room is full"}`),
// 		}
// 		return
// 	}

// 	// Add client to room
// 	room.Mutex.Lock()
// 	room.Clients[client.ID] = client
// 	client.RoomID = msg.RoomID
// 	room.Mutex.Unlock()

// 	// Update database
// 	s.DB.Exec("UPDATE rooms SET user_count = ? WHERE id = ?", 
// 		len(room.Clients), msg.RoomID)

// 	// Notify other users in room
// 	for _, otherClient := range room.Clients {
// 		if otherClient.ID != client.ID {
// 			otherClient.Send <- Message{
// 				Type:   UserJoined,
// 				UserID: client.ID,
// 				RoomID: msg.RoomID,
// 			}
// 		}
// 	}

// 	log.Printf("Client %s joined room %s", client.ID, msg.RoomID)
// }

// func (s *Server) handleLeaveRoom(msg Message) {
// 	s.Mutex.Lock()
// 	defer s.Mutex.Unlock()

// 	client, exists := s.Clients[msg.UserID]
// 	if !exists || client.RoomID == "" {
// 		return
// 	}

// 	s.removeFromRoom(client)
// }

// func (s *Server) removeFromRoom(client *Client) {
// 	if client.RoomID == "" {
// 		return
// 	}

// 	room, exists := s.Rooms[client.RoomID]
// 	if !exists {
// 		return
// 	}

// 	room.Mutex.Lock()
// 	delete(room.Clients, client.ID)
// 	roomID := client.RoomID
// 	client.RoomID = ""
// 	room.Mutex.Unlock()

// 	// Notify other users
// 	for _, otherClient := range room.Clients {
// 		otherClient.Send <- Message{
// 			Type:   UserLeft,
// 			UserID: client.ID,
// 			RoomID: roomID,
// 		}
// 	}

// 	// Update database
// 	s.DB.Exec("UPDATE rooms SET user_count = ? WHERE id = ?", 
// 		len(room.Clients), roomID)

// 	// Clean up empty room
// 	if len(room.Clients) == 0 {
// 		delete(s.Rooms, roomID)
// 		s.DB.Exec("DELETE FROM rooms WHERE id = ?", roomID)
// 	}

// 	log.Printf("Client %s left room %s", client.ID, roomID)
// }

// func (s *Server) handleSignaling(msg Message) {
// 	s.Mutex.RLock()
// 	defer s.Mutex.RUnlock()

// 	sender, exists := s.Clients[msg.UserID]
// 	if !exists || sender.RoomID == "" {
// 		return
// 	}

// 	room, exists := s.Rooms[sender.RoomID]
// 	if !exists {
// 		return
// 	}

// 	// Forward signaling message to target or all other clients in room
// 	room.Mutex.RLock()
// 	if msg.TargetID != "" {
// 		// Direct message to specific user
// 		if target, exists := room.Clients[msg.TargetID]; exists {
// 			target.Send <- msg
// 		}
// 	} else {
// 		// Broadcast to all other clients in room
// 		for _, client := range room.Clients {
// 			if client.ID != sender.ID {
// 				client.Send <- msg
// 			}
// 		}
// 	}
// 	room.Mutex.RUnlock()
// }

// func (c *Client) readPump() {
// 	defer func() {
// 		c.Server.Unregister <- c
// 		c.Conn.Close()
// 	}()

// 	c.Conn.SetReadLimit(512)
// 	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
// 	c.Conn.SetPongHandler(func(string) error {
// 		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
// 		return nil
// 	})

// 	for {
// 		var msg Message
// 		err := c.Conn.ReadJSON(&msg)
// 		if err != nil {
// 			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
// 				log.Printf("WebSocket error: %v", err)
// 			}
// 			break
// 		}

// 		// Set user ID for message
// 		msg.UserID = c.ID

// 		c.Server.Broadcast <- msg
// 	}
// }

// func (c *Client) writePump() {
// 	ticker := time.NewTicker(54 * time.Second)
// 	defer func() {
// 		ticker.Stop()
// 		c.Conn.Close()
// 	}()

// 	for {
// 		select {
// 		case message, ok := <-c.Send:
// 			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
// 			if !ok {
// 				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
// 				return
// 			}

// 			if err := c.Conn.WriteJSON(message); err != nil {
// 				log.Printf("WebSocket write error: %v", err)
// 				return
// 			}

// 		case <-ticker.C:
// 			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
// 			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
// 				return
// 			}
// 		}
// 	}
// }

// func handleWebSocket(server *Server, w http.ResponseWriter, r *http.Request) {
// 	conn, err := upgrader.Upgrade(w, r, nil)
// 	if err != nil {
// 		log.Printf("WebSocket upgrade error: %v", err)
// 		return
// 	}

// 	// Generate unique client ID
// 	clientID := generateClientID()
	
// 	client := &Client{
// 		ID:     clientID,
// 		Conn:   conn,
// 		Send:   make(chan Message, 256),
// 		Server: server,
// 	}

// 	server.Register <- client

// 	go client.writePump()
// 	go client.readPump()
// }

// func generateClientID() string {
// 	return time.Now().Format("20060102150405") + "-" + 
// 		   string(rune(time.Now().UnixNano()%26+65)) + 
// 		   string(rune(time.Now().UnixNano()%26+65))
// }

// func main() {
// 	server := NewServer()
// 	go server.Run()

// 	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
// 		handleWebSocket(server, w, r)
// 	})

// 	// Health check endpoint
// 	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
// 		w.WriteHeader(http.StatusOK)
// 		w.Write([]byte("OK"))
// 	})

// 	// Serve static files
// 	http.Handle("/", http.FileServer(http.Dir("./static/")))

// 	log.Println("WebRTC signaling server starting on :8080")
// 	log.Fatal(http.ListenAndServe(":8080", nil))
// }


package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
)

// Message types for WebSocket communication
type MessageType string

const (
	JoinRoom     MessageType = "join_room"
	LeaveRoom    MessageType = "leave_room"
	Offer        MessageType = "offer"
	Answer       MessageType = "answer"
	ICECandidate MessageType = "ice_candidate"
	UserJoined   MessageType = "user_joined"
	UserLeft     MessageType = "user_left"
	Error        MessageType = "error"
)

// WebSocket message structure
type Message struct {
	Type     MessageType     `json:"type"`
	RoomID   string          `json:"room_id,omitempty"`
	UserID   string          `json:"user_id,omitempty"`
	TargetID string          `json:"target_id,omitempty"`
	Data     json.RawMessage `json:"data,omitempty"`
}

// Client represents a WebSocket connection
type Client struct {
	ID     string
	Conn   *websocket.Conn
	RoomID string
	Send   chan Message
	Server *Server
}

// Room represents a voice chat room
type Room struct {
	ID      string
	Clients map[string]*Client
	Mutex   sync.RWMutex
}

// Server manages all connections and rooms
type Server struct {
	Clients    map[string]*Client
	Rooms      map[string]*Room
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan Message
	Mutex      sync.RWMutex
	DB         *sql.DB
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for demo
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func NewServer() *Server {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	// Create rooms table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS rooms (
			id TEXT PRIMARY KEY,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			user_count INTEGER DEFAULT 0
		)
	`)
	if err != nil {
		log.Fatal("Failed to create rooms table:", err)
	}

	return &Server{
		Clients:    make(map[string]*Client),
		Rooms:      make(map[string]*Room),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan Message),
		DB:         db,
	}
}

func (s *Server) Run() {
	for {
		select {
		case client := <-s.Register:
			s.Mutex.Lock()
			s.Clients[client.ID] = client
			s.Mutex.Unlock()
			log.Printf("Client %s connected", client.ID)

		case client := <-s.Unregister:
			s.Mutex.Lock()
			if _, ok := s.Clients[client.ID]; ok {
				delete(s.Clients, client.ID)
				
				// Remove from room before closing channel
				if client.RoomID != "" {
					s.removeFromRoom(client)
				}
				
				// Close the send channel
				close(client.Send)
			}
			s.Mutex.Unlock()
			log.Printf("Client %s disconnected", client.ID)

		case message := <-s.Broadcast:
			s.handleMessage(message)
		}
	}
}

func (s *Server) handleMessage(msg Message) {
	switch msg.Type {
	case JoinRoom:
		s.handleJoinRoom(msg)
	case LeaveRoom:
		s.handleLeaveRoom(msg)
	case Offer, Answer, ICECandidate:
		s.handleSignaling(msg)
	}
}

func (s *Server) handleJoinRoom(msg Message) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()

	client, exists := s.Clients[msg.UserID]
	if !exists {
		log.Printf("Client %s not found for join room", msg.UserID)
		return
	}

	// Remove from current room if any
	if client.RoomID != "" {
		s.removeFromRoomUnsafe(client)
	}

	// Get or create room
	room, exists := s.Rooms[msg.RoomID]
	if !exists {
		room = &Room{
			ID:      msg.RoomID,
			Clients: make(map[string]*Client),
		}
		s.Rooms[msg.RoomID] = room
		
		// Insert room into database
		s.DB.Exec("INSERT OR REPLACE INTO rooms (id, user_count) VALUES (?, ?)", 
			msg.RoomID, 0)
	}

	// Check room capacity (max 2 for P2P)
	if len(room.Clients) >= 2 {
		select {
		case client.Send <- Message{
			Type: Error,
			Data: json.RawMessage(`{"message": "Room is full"}`),
		}:
		default:
			log.Printf("Could not send error message to client %s", client.ID)
		}
		return
	}

	// Add client to room
	room.Mutex.Lock()
	room.Clients[client.ID] = client
	client.RoomID = msg.RoomID
	room.Mutex.Unlock()

	// Update database
	s.DB.Exec("UPDATE rooms SET user_count = ? WHERE id = ?", 
		len(room.Clients), msg.RoomID)

	// Notify other users in room that someone joined
	room.Mutex.RLock()
	for _, otherClient := range room.Clients {
		if otherClient.ID != client.ID {
			select {
			case otherClient.Send <- Message{
				Type:   UserJoined,
				UserID: client.ID,
				RoomID: msg.RoomID,
			}:
			default:
				log.Printf("Could not send user_joined to client %s", otherClient.ID)
			}
		}
	}
	room.Mutex.RUnlock()

	log.Printf("Client %s joined room %s (%d users)", client.ID, msg.RoomID, len(room.Clients))
}

func (s *Server) handleLeaveRoom(msg Message) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()

	client, exists := s.Clients[msg.UserID]
	if !exists || client.RoomID == "" {
		return
	}

	s.removeFromRoomUnsafe(client)
}

func (s *Server) removeFromRoom(client *Client) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	s.removeFromRoomUnsafe(client)
}

func (s *Server) removeFromRoomUnsafe(client *Client) {
	if client.RoomID == "" {
		return
	}

	room, exists := s.Rooms[client.RoomID]
	if !exists {
		return
	}

	room.Mutex.Lock()
	delete(room.Clients, client.ID)
	roomID := client.RoomID
	client.RoomID = ""
	roomClientsCount := len(room.Clients)
	
	// Get remaining clients before unlocking
	remainingClients := make([]*Client, 0, len(room.Clients))
	for _, c := range room.Clients {
		remainingClients = append(remainingClients, c)
	}
	room.Mutex.Unlock()

	// Notify other users
	for _, otherClient := range remainingClients {
		select {
		case otherClient.Send <- Message{
			Type:   UserLeft,
			UserID: client.ID,
			RoomID: roomID,
		}:
		default:
			log.Printf("Could not send user_left to client %s", otherClient.ID)
		}
	}

	// Update database
	s.DB.Exec("UPDATE rooms SET user_count = ? WHERE id = ?", 
		roomClientsCount, roomID)

	// Clean up empty room
	if roomClientsCount == 0 {
		delete(s.Rooms, roomID)
		s.DB.Exec("DELETE FROM rooms WHERE id = ?", roomID)
	}

	log.Printf("Client %s left room %s (%d users remaining)", client.ID, roomID, roomClientsCount)
}

func (s *Server) handleSignaling(msg Message) {
	s.Mutex.RLock()
	sender, exists := s.Clients[msg.UserID]
	if !exists || sender.RoomID == "" {
		s.Mutex.RUnlock()
		return
	}

	room, exists := s.Rooms[sender.RoomID]
	if !exists {
		s.Mutex.RUnlock()
		return
	}
	s.Mutex.RUnlock()

	// Forward signaling message to target or all other clients in room
	room.Mutex.RLock()
	defer room.Mutex.RUnlock()

	if msg.TargetID != "" {
		// Direct message to specific user
		if target, exists := room.Clients[msg.TargetID]; exists {
			select {
			case target.Send <- msg:
			default:
				log.Printf("Could not send signaling message to target %s", msg.TargetID)
			}
		}
	} else {
		// Broadcast to all other clients in room
		for _, client := range room.Clients {
			if client.ID != sender.ID {
				select {
				case client.Send <- msg:
				default:
					log.Printf("Could not send signaling message to client %s", client.ID)
				}
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.Server.Unregister <- c
		c.Conn.Close()
	}()

	// Increase read limit and timeout
	c.Conn.SetReadLimit(2048)
	c.Conn.SetReadDeadline(time.Now().Add(120 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(120 * time.Second))
		return nil
	})

	for {
		var msg Message
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for client %s: %v", c.ID, err)
			}
			break
		}

		// Set user ID for message
		msg.UserID = c.ID

		// Send to broadcast channel with timeout
		select {
		case c.Server.Broadcast <- msg:
		case <-time.After(5 * time.Second):
			log.Printf("Broadcast timeout for client %s", c.ID)
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(110 * time.Second) // Increased ping interval
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(message); err != nil {
				log.Printf("WebSocket write error for client %s: %v", c.ID, err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Ping error for client %s: %v", c.ID, err)
				return
			}
		}
	}
}

func handleWebSocket(server *Server, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Generate unique client ID
	clientID := generateClientID()
	
	client := &Client{
		ID:     clientID,
		Conn:   conn,
		Send:   make(chan Message, 512), // Increased buffer size
		Server: server,
	}

	server.Register <- client

	go client.writePump()
	go client.readPump()
}

func generateClientID() string {
	return time.Now().Format("20060102150405") + "-" + 
		   string(rune(time.Now().UnixNano()%26+65)) + 
		   string(rune((time.Now().UnixNano()/1000)%26+65)) +
		   string(rune((time.Now().UnixNano()/1000000)%10+48))
}

func main() {
	server := NewServer()
	go server.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(server, w, r)
	})

	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Serve static files
	http.Handle("/", http.FileServer(http.Dir("./static/")))

	log.Println("WebRTC signaling server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}