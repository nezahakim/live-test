// class VoiceChat {
//     constructor() {
//         this.ws = null;
//         this.peerConnection = null;
//         this.localStream = null;
//         this.remoteStream = null;
//         this.roomId = null;
//         this.userId = null;
//         this.isMuted = false;
//         this.isConnected = false;
        
//         // Audio analysis
//         this.audioContext = null;
//         this.localAnalyser = null;
//         this.remoteAnalyser = null;
        
//         // STUN servers for NAT traversal
//         this.iceServers = [
//             { urls: 'stun:stun.l.google.com:19302' },
//             { urls: 'stun:stun1.l.google.com:19302' },
//             { urls: 'stun:stun2.l.google.com:19302' }
//         ];
        
//         this.initElements();
//         this.initEventListeners();
//     }
    
//     initElements() {
//         this.elements = {
//             roomId: document.getElementById('roomId'),
//             joinBtn: document.getElementById('joinBtn'),
//             leaveBtn: document.getElementById('leaveBtn'),
//             muteBtn: document.getElementById('muteBtn'),
//             status: document.getElementById('status'),
//             audioControls: document.getElementById('audioControls'),
//             peerInfo: document.getElementById('peerInfo'),
//             connectionDetails: document.getElementById('connectionDetails'),
//             remoteAudio: document.getElementById('remoteAudio'),
//             localVolume: document.getElementById('localVolume'),
//             remoteVolume: document.getElementById('remoteVolume')
//         };
//     }
    
//     initEventListeners() {
//         this.elements.joinBtn.addEventListener('click', () => this.joinRoom());
//         this.elements.leaveBtn.addEventListener('click', () => this.leaveRoom());
//         this.elements.muteBtn.addEventListener('click', () => this.toggleMute());
        
//         // Enter key support
//         this.elements.roomId.addEventListener('keypress', (e) => {
//             if (e.key === 'Enter') this.joinRoom();
//         });
//     }
    
//     updateStatus(message, type = 'info') {
//         this.elements.status.textContent = message;
//         this.elements.status.className = `status ${type}`;
//         console.log(`[${type.toUpperCase()}] ${message}`);
//     }
    
//     async joinRoom() {
//         const roomId = this.elements.roomId.value.trim();
//         if (!roomId) {
//             this.updateStatus('Please enter a room ID', 'error');
//             return;
//         }
        
//         try {
//             this.updateStatus('Requesting microphone access...', 'info');
//             await this.initAudio();
            
//             this.updateStatus('Connecting to server...', 'info');
//             await this.connectWebSocket();
            
//             this.roomId = roomId;
//             this.sendMessage({
//                 type: 'join_room',
//                 room_id: roomId
//             });
            
//             this.elements.joinBtn.disabled = true;
//             this.elements.leaveBtn.disabled = false;
//             this.elements.muteBtn.disabled = false;
//             this.elements.roomId.disabled = true;
//             this.elements.audioControls.classList.remove('hidden');
            
//         } catch (error) {
//             this.updateStatus(`Failed to join room: ${error.message}`, 'error');
//         }
//     }
    
//     leaveRoom() {
//         if (this.roomId) {
//             this.sendMessage({
//                 type: 'leave_room',
//                 room_id: this.roomId
//             });
//         }
        
//         this.cleanup();
//         this.resetUI();
//         this.updateStatus('Left room', 'info');
//     }
    
//     resetUI() {
//         this.elements.joinBtn.disabled = false;
//         this.elements.leaveBtn.disabled = true;
//         this.elements.muteBtn.disabled = true;
//         this.elements.roomId.disabled = false;
//         this.elements.audioControls.classList.add('hidden');
//         this.elements.peerInfo.classList.add('hidden');
//         this.elements.muteBtn.textContent = 'Mute';
//     }
    
//     toggleMute() {
//         if (!this.localStream) return;
        
//         const audioTrack = this.localStream.getAudioTracks()[0];
//         if (audioTrack) {
//             audioTrack.enabled = !audioTrack.enabled;
//             this.isMuted = !audioTrack.enabled;
//             this.elements.muteBtn.textContent = this.isMuted ? 'Unmute' : 'Mute';
//             this.updateStatus(this.isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
//         }
//     }
    
//     async initAudio() {
//         try {
//             this.localStream = await navigator.mediaDevices.getUserMedia({
//                 audio: {
//                     echoCancellation: true,
//                     noiseSuppression: true,
//                     autoGainControl: true,
//                     sampleRate: 48000
//                 }
//             });
            
//             this.initAudioAnalysis();
//             this.updateStatus('Microphone access granted', 'success');
            
//         } catch (error) {
//             throw new Error(`Microphone access denied: ${error.message}`);
//         }
//     }
    
//     initAudioAnalysis() {
//         try {
//             this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
//             // Local audio analysis
//             const localSource = this.audioContext.createMediaStreamSource(this.localStream);
//             this.localAnalyser = this.audioContext.createAnalyser();
//             this.localAnalyser.fftSize = 256;
//             localSource.connect(this.localAnalyser);
            
//             this.startVolumeMonitoring();
            
//         } catch (error) {
//             console.warn('Audio analysis not available:', error);
//         }
//     }
    
//     startVolumeMonitoring() {
//         const updateVolume = () => {
//             if (this.localAnalyser) {
//                 const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);
//                 this.localAnalyser.getByteFrequencyData(dataArray);
//                 const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
//                 const percentage = Math.min(100, (volume / 128) * 100);
//                 this.elements.localVolume.style.width = `${percentage}%`;
//             }
            
//             if (this.remoteAnalyser) {
//                 const dataArray = new Uint8Array(this.remoteAnalyser.frequencyBinCount);
//                 this.remoteAnalyser.getByteFrequencyData(dataArray);
//                 const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
//                 const percentage = Math.min(100, (volume / 128) * 100);
//                 this.elements.remoteVolume.style.width = `${percentage}%`;
//             }
            
//             if (this.isConnected) {
//                 requestAnimationFrame(updateVolume);
//             }
//         };
        
//         updateVolume();
//     }
    
//     async connectWebSocket() {
//         return new Promise((resolve, reject) => {
//             const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//             const wsUrl = `${protocol}//${window.location.host}/ws`;
            
//             this.ws = new WebSocket(wsUrl);
            
//             this.ws.onopen = () => {
//                 this.isConnected = true;
//                 resolve();
//             };
            
//             this.ws.onmessage = (event) => {
//                 this.handleMessage(JSON.parse(event.data));
//             };
            
//             this.ws.onclose = () => {
//                 this.isConnected = false;
//                 this.updateStatus('Disconnected from server', 'error');
//                 this.cleanup();
//             };
            
//             this.ws.onerror = (error) => {
//                 reject(new Error('WebSocket connection failed'));
//             };
            
//             // Timeout after 5 seconds
//             setTimeout(() => {
//                 if (this.ws.readyState !== WebSocket.OPEN) {
//                     reject(new Error('Connection timeout'));
//                 }
//             }, 5000);
//         });
//     }
    
//     sendMessage(message) {
//         if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//             this.ws.send(JSON.stringify(message));
//         }
//     }
    
//     async handleMessage(message) {
//         console.log('Received message:', message);
        
//         switch (message.type) {
//             case 'user_joined':
//                 this.updateStatus(`User joined room. Initiating connection...`, 'success');
//                 await this.createOffer();
//                 break;
                
//             case 'user_left':
//                 this.updateStatus('Other user left the room', 'info');
//                 this.closePeerConnection();
//                 break;
                
//             case 'offer':
//                 this.updateStatus('Received call offer. Answering...', 'info');
//                 await this.handleOffer(message.data);
//                 break;
                
//             case 'answer':
//                 this.updateStatus('Received call answer. Establishing connection...', 'info');
//                 await this.handleAnswer(message.data);
//                 break;
                
//             case 'ice_candidate':
//                 await this.handleIceCandidate(message.data);
//                 break;
                
//             case 'error':
//                 const errorData = JSON.parse(message.data);
//                 this.updateStatus(errorData.message, 'error');
//                 break;
//         }
//     }
    
//     async createPeerConnection() {
//         this.peerConnection = new RTCPeerConnection({
//             iceServers: this.iceServers
//         });
        
//         // Add local stream
//         this.localStream.getTracks().forEach(track => {
//             this.peerConnection.addTrack(track, this.localStream);
//         });
        
//         // Handle remote stream
//         this.peerConnection.ontrack = (event) => {
//             this.remoteStream = event.streams[0];
//             this.elements.remoteAudio.srcObject = this.remoteStream;
//             this.updateStatus('Voice connection established!', 'success');
//             this.showConnectionInfo();
            
//             // Setup remote audio analysis
//             if (this.audioContext) {
//                 const remoteSource = this.audioContext.createMediaStreamSource(this.remoteStream);
//                 this.remoteAnalyser = this.audioContext.createAnalyser();
//                 this.remoteAnalyser.fftSize = 256;
//                 remoteSource.connect(this.remoteAnalyser);
//             }
//         };
        
//         // Handle ICE candidates
//         this.peerConnection.onicecandidate = (event) => {
//             if (event.candidate) {
//                 this.sendMessage({
//                     type: 'ice_candidate',
//                     room_id: this.roomId,
//                     data: event.candidate
//                 });
//             }
//         };
        
//         // Connection state monitoring
//         this.peerConnection.onconnectionstatechange = () => {
//             const state = this.peerConnection.connectionState;
//             console.log('Connection state:', state);
            
//             if (state === 'connected') {
//                 this.updateStatus('Voice connection active', 'success');
//             } else if (state === 'disconnected' || state === 'failed') {
//                 this.updateStatus('Connection lost', 'error');
//             }
//         };
//     }
    
//     async createOffer() {
//         await this.createPeerConnection();
        
//         const offer = await this.peerConnection.createOffer({
//             offerToReceiveAudio: true
//         });
        
//         await this.peerConnection.setLocalDescription(offer);
        
//         this.sendMessage({
//             type: 'offer',
//             room_id: this.roomId,
//             data: offer
//         });
//     }
    
//     async handleOffer(offer) {
//         await this.createPeerConnection();
        
//         await this.peerConnection.setRemoteDescription(offer);
        
//         const answer = await this.peerConnection.createAnswer();
//         await this.peerConnection.setLocalDescription(answer);
        
//         this.sendMessage({
//             type: 'answer',
//             room_id: this.roomId,
//             data: answer
//         });
//     }
    
//     async handleAnswer(answer) {
//         await this.peerConnection.setRemoteDescription(answer);
//     }
    
//     async handleIceCandidate(candidate) {
//         if (this.peerConnection) {
//             await this.peerConnection.addIceCandidate(candidate);
//         }
//     }
    
//     showConnectionInfo() {
//         this.elements.peerInfo.classList.remove('hidden');
        
//         if (this.peerConnection) {
//             this.peerConnection.getStats().then(stats => {
//                 let connectionInfo = '<strong>Connection Statistics:</strong><br>';
                
//                 stats.forEach(report => {
//                     if (report.type === 'candidate-pair' && report.state === 'succeeded') {
//                         connectionInfo += `Connection Type: ${report.currentRoundTripTime ? 'P2P Direct' : 'Relayed'}<br>`;
//                         if (report.currentRoundTripTime) {
//                             connectionInfo += `Round Trip Time: ${Math.round(report.currentRoundTripTime * 1000)}ms<br>`;
//                         }
//                     }
                    
//                     if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
//                         connectionInfo += `Audio Packets Received: ${report.packetsReceived || 0}<br>`;
//                         connectionInfo += `Audio Packets Lost: ${report.packetsLost || 0}<br>`;
//                     }
//                 });
                
//                 this.elements.connectionDetails.innerHTML = connectionInfo;
//             });
//         }
//     }
    
//     closePeerConnection() {
//         if (this.peerConnection) {
//             this.peerConnection.close();
//             this.peerConnection = null;
//         }
        
//         if (this.remoteStream) {
//             this.remoteStream.getTracks().forEach(track => track.stop());
//             this.remoteStream = null;
//         }
        
//         this.elements.remoteAudio.srcObject = null;
//         this.elements.peerInfo.classList.add('hidden');
//         this.remoteAnalyser = null;
//     }
    
//     cleanup() {
//         this.isConnected = false;
        
//         if (this.ws) {
//             this.ws.close();
//             this.ws = null;
//         }
        
//         this.closePeerConnection();
        
//         if (this.localStream) {
//             this.localStream.getTracks().forEach(track => track.stop());
//             this.localStream = null;
//         }
        
//         if (this.audioContext) {
//             this.audioContext.close();
//             this.audioContext = null;
//         }
        
//         this.localAnalyser = null;
//         this.roomId = null;
//         this.userId = null;
//         this.isMuted = false;
//     }
// }

// // Initialize the voice chat when page loads
// document.addEventListener('DOMContentLoaded', () => {
//     window.voiceChat = new VoiceChat();
// });

// // Handle page unload
// window.addEventListener('beforeunload', () => {
//     if (window.voiceChat) {
//         window.voiceChat.cleanup();
//     }
// });

class VoiceChat {
    constructor() {
        this.ws = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.roomId = null;
        this.userId = null;
        this.isMuted = false;
        this.isConnected = false;
        this.isConnecting = false;
        
        // Audio analysis
        this.audioContext = null;
        this.localAnalyser = null;
        this.remoteAnalyser = null;
        
        // Connection state
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // STUN servers for NAT traversal
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' }
        ];
        
        this.initElements();
        this.initEventListeners();
    }
    
    initElements() {
        this.elements = {
            roomId: document.getElementById('roomId'),
            joinBtn: document.getElementById('joinBtn'),
            leaveBtn: document.getElementById('leaveBtn'),
            muteBtn: document.getElementById('muteBtn'),
            status: document.getElementById('status'),
            audioControls: document.getElementById('audioControls'),
            peerInfo: document.getElementById('peerInfo'),
            connectionDetails: document.getElementById('connectionDetails'),
            remoteAudio: document.getElementById('remoteAudio'),
            localVolume: document.getElementById('localVolume'),
            remoteVolume: document.getElementById('remoteVolume')
        };
    }
    
    initEventListeners() {
        this.elements.joinBtn.addEventListener('click', () => this.joinRoom());
        this.elements.leaveBtn.addEventListener('click', () => this.leaveRoom());
        this.elements.muteBtn.addEventListener('click', () => this.toggleMute());
        
        // Enter key support
        this.elements.roomId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // Prevent multiple clicks
        this.elements.joinBtn.addEventListener('click', (e) => {
            if (this.isConnecting) {
                e.preventDefault();
                return false;
            }
        });
    }
    
    updateStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
    
    async joinRoom() {
        if (this.isConnecting || this.isConnected) {
            return;
        }
        
        const roomId = this.elements.roomId.value.trim();
        if (!roomId) {
            this.updateStatus('Please enter a room ID', 'error');
            return;
        }
        
        this.isConnecting = true;
        this.elements.joinBtn.disabled = true;
        
        try {
            this.updateStatus('Requesting microphone access...', 'info');
            await this.initAudio();
            
            this.updateStatus('Connecting to server...', 'info');
            await this.connectWebSocket();
            
            this.roomId = roomId;
            this.sendMessage({
                type: 'join_room',
                room_id: roomId
            });
            
            this.elements.leaveBtn.disabled = false;
            this.elements.muteBtn.disabled = false;
            this.elements.roomId.disabled = true;
            this.elements.audioControls.classList.remove('hidden');
            
            this.updateStatus(`Joined room: ${roomId}. Waiting for another user...`, 'success');
            
        } catch (error) {
            this.updateStatus(`Failed to join room: ${error.message}`, 'error');
            this.resetConnectionState();
        }
    }
    
    resetConnectionState() {
        this.isConnecting = false;
        this.elements.joinBtn.disabled = false;
    }
    
    leaveRoom() {
        if (this.roomId) {
            this.sendMessage({
                type: 'leave_room',
                room_id: this.roomId
            });
        }
        
        this.cleanup();
        this.resetUI();
        this.updateStatus('Left room', 'info');
    }
    
    resetUI() {
        this.elements.joinBtn.disabled = false;
        this.elements.leaveBtn.disabled = true;
        this.elements.muteBtn.disabled = true;
        this.elements.roomId.disabled = false;
        this.elements.audioControls.classList.add('hidden');
        this.elements.peerInfo.classList.add('hidden');
        this.elements.muteBtn.textContent = 'Mute';
        this.isConnecting = false;
    }
    
    toggleMute() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;
            this.elements.muteBtn.textContent = this.isMuted ? 'Unmute' : 'Mute';
            this.updateStatus(this.isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
        }
    }
    
    async initAudio() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000
                }
            });
            
            this.initAudioAnalysis();
            this.updateStatus('Microphone access granted', 'success');
            
        } catch (error) {
            throw new Error(`Microphone access denied: ${error.message}`);
        }
    }
    
    initAudioAnalysis() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            // Local audio analysis
            const localSource = this.audioContext.createMediaStreamSource(this.localStream);
            this.localAnalyser = this.audioContext.createAnalyser();
            this.localAnalyser.fftSize = 256;
            localSource.connect(this.localAnalyser);
            
            this.startVolumeMonitoring();
            
        } catch (error) {
            console.warn('Audio analysis not available:', error);
        }
    }
    
    startVolumeMonitoring() {
        const updateVolume = () => {
            if (this.localAnalyser && this.isConnected) {
                const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);
                this.localAnalyser.getByteFrequencyData(dataArray);
                const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const percentage = Math.min(100, (volume / 128) * 100);
                this.elements.localVolume.style.width = `${percentage}%`;
            }
            
            if (this.remoteAnalyser && this.isConnected) {
                const dataArray = new Uint8Array(this.remoteAnalyser.frequencyBinCount);
                this.remoteAnalyser.getByteFrequencyData(dataArray);
                const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const percentage = Math.min(100, (volume / 128) * 100);
                this.elements.remoteVolume.style.width = `${percentage}%`;
            }
            
            if (this.isConnected || this.isConnecting) {
                requestAnimationFrame(updateVolume);
            }
        };
        
        updateVolume();
    }
    
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.ws = new WebSocket(wsUrl);
            
            // Set a longer timeout
            const connectionTimeout = setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN) {
                    this.ws.close();
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
            
            this.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                console.log('WebSocket connected');
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            this.ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                this.isConnected = false;
                console.log('WebSocket closed:', event.code, event.reason);
                
                if (event.code !== 1000 && this.roomId) { // Not a normal closure
                    this.updateStatus('Connection lost. Attempting to reconnect...', 'error');
                    this.attemptReconnect();
                } else {
                    this.updateStatus('Disconnected from server', 'info');
                }
            };
            
            this.ws.onerror = (error) => {
                clearTimeout(connectionTimeout);
                console.error('WebSocket error:', error);
                if (this.ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('WebSocket connection failed'));
                }
            };
        });
    }
    
    async attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.updateStatus('Failed to reconnect. Please try joining again.', 'error');
            this.cleanup();
            this.resetUI();
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        setTimeout(async () => {
            try {
                await this.connectWebSocket();
                
                if (this.roomId) {
                    this.sendMessage({
                        type: 'join_room',
                        room_id: this.roomId
                    });
                }
                
                this.updateStatus('Reconnected successfully', 'success');
            } catch (error) {
                console.error('Reconnection failed:', error);
                this.attemptReconnect();
            }
        }, delay);
    }
    
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('Cannot send message - WebSocket not connected');
        }
    }
    
    async handleMessage(message) {
        console.log('Received message:', message);
        
        try {
            switch (message.type) {
                case 'user_joined':
                    this.updateStatus(`User joined room. Initiating connection...`, 'success');
                    // Small delay to ensure both clients are ready
                    setTimeout(() => this.createOffer(), 500);
                    break;
                    
                case 'user_left':
                    this.updateStatus('Other user left the room', 'info');
                    this.closePeerConnection();
                    break;
                    
                case 'offer':
                    this.updateStatus('Received call offer. Answering...', 'info');
                    await this.handleOffer(message.data);
                    break;
                    
                case 'answer':
                    this.updateStatus('Received call answer. Establishing connection...', 'info');
                    await this.handleAnswer(message.data);
                    break;
                    
                case 'ice_candidate':
                    await this.handleIceCandidate(message.data);
                    break;
                    
                case 'error':
                    const errorData = JSON.parse(message.data);
                    this.updateStatus(errorData.message, 'error');
                    if (errorData.message === 'Room is full') {
                        this.resetConnectionState();
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.updateStatus(`Error handling message: ${error.message}`, 'error');
        }
    }
    
    async createPeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        this.peerConnection = new RTCPeerConnection({
            iceServers: this.iceServers
        });
        
        // Add local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }
        
        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote track');
            this.remoteStream = event.streams[0];
            this.elements.remoteAudio.srcObject = this.remoteStream;
            this.updateStatus('Voice connection established!', 'success');
            this.showConnectionInfo();
            
            // Setup remote audio analysis
            if (this.audioContext && this.remoteStream) {
                try {
                    const remoteSource = this.audioContext.createMediaStreamSource(this.remoteStream);
                    this.remoteAnalyser = this.audioContext.createAnalyser();
                    this.remoteAnalyser.fftSize = 256;
                    remoteSource.connect(this.remoteAnalyser);
                } catch (error) {
                    console.warn('Failed to setup remote audio analysis:', error);
                }
            }
        };
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendMessage({
                    type: 'ice_candidate',
                    room_id: this.roomId,
                    data: event.candidate
                });
            }
        };
        
        // Connection state monitoring
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Peer connection state:', state);
            
            switch (state) {
                case 'connected':
                    this.updateStatus('Voice connection active', 'success');
                    break;
                case 'disconnected':
                    this.updateStatus('Peer connection lost', 'error');
                    break;
                case 'failed':
                    this.updateStatus('Connection failed - trying to reconnect', 'error');
                    this.closePeerConnection();
                    break;
                case 'closed':
                    this.updateStatus('Connection closed', 'info');
                    break;
            }
        };
        
        // ICE connection state monitoring
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log('ICE connection state:', state);
            
            if (state === 'failed' || state === 'disconnected') {
                // Try to restart ICE
                this.peerConnection.restartIce();
            }
        };
    }
    
    async createOffer() {
        try {
            await this.createPeerConnection();
            
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            this.sendMessage({
                type: 'offer',
                room_id: this.roomId,
                data: offer
            });
            
        } catch (error) {
            console.error('Error creating offer:', error);
            this.updateStatus(`Failed to create offer: ${error.message}`, 'error');
        }
    }
    
    async handleOffer(offer) {
        try {
            await this.createPeerConnection();
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.sendMessage({
                type: 'answer',
                room_id: this.roomId,
                data: answer
            });
            
        } catch (error) {
            console.error('Error handling offer:', error);
            this.updateStatus(`Failed to handle offer: ${error.message}`, 'error');
        }
    }
    
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
            this.updateStatus(`Failed to handle answer: ${error.message}`, 'error');
        }
    }
    
    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                // Queue the candidate if remote description is not set yet
                if (!this.pendingCandidates) {
                    this.pendingCandidates = [];
                }
                this.pendingCandidates.push(candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }
    
    async processPendingCandidates() {
        if (this.pendingCandidates && this.peerConnection) {
            for (const candidate of this.pendingCandidates) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Error adding pending ICE candidate:', error);
                }
            }
            this.pendingCandidates = [];
        }
    }
    
    showConnectionInfo() {
        this.elements.peerInfo.classList.remove('hidden');
        
        if (this.peerConnection) {
            // Wait a bit for stats to be available
            setTimeout(() => {
                this.peerConnection.getStats().then(stats => {
                    let connectionInfo = '<strong>Connection Statistics:</strong><br>';
                    let hasStats = false;
                    
                    stats.forEach(report => {
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                            hasStats = true;
                            connectionInfo += `Connection Type: ${report.currentRoundTripTime ? 'P2P Direct' : 'Relayed'}<br>`;
                            if (report.currentRoundTripTime) {
                                connectionInfo += `Round Trip Time: ${Math.round(report.currentRoundTripTime * 1000)}ms<br>`;
                            }
                        }
                        
                        if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                            hasStats = true;
                            connectionInfo += `Audio Packets Received: ${report.packetsReceived || 0}<br>`;
                            connectionInfo += `Audio Packets Lost: ${report.packetsLost || 0}<br>`;
                        }
                    });
                    
                    if (!hasStats) {
                        connectionInfo += 'Connection established successfully<br>';
                    }
                    
                    this.elements.connectionDetails.innerHTML = connectionInfo;
                }).catch(err => {
                    console.warn('Could not get connection stats:', err);
                    this.elements.connectionDetails.innerHTML = '<strong>Connection established</strong><br>';
                });
            }, 2000);
        }
    }
    
    closePeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        this.elements.remoteAudio.srcObject = null;
        this.elements.peerInfo.classList.add('hidden');
        this.remoteAnalyser = null;
        this.pendingCandidates = [];
        
        this.updateStatus('Peer connection closed. Waiting for another user...', 'info');
    }
    
    cleanup() {
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        if (this.ws) {
            this.ws.close(1000, 'Normal closure');
            this.ws = null;
        }
        
        this.closePeerConnection();
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.localAnalyser = null;
        this.roomId = null;
        this.userId = null;
        this.isMuted = false;
    }
}

// Initialize the voice chat when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.voiceChat = new VoiceChat();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.voiceChat) {
        window.voiceChat.cleanup();
    }
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (window.voiceChat && window.voiceChat.audioContext) {
        if (document.hidden) {
            if (window.voiceChat.audioContext.state === 'running') {
                window.voiceChat.audioContext.suspend();
            }
        } else {
            if (window.voiceChat.audioContext.state === 'suspended') {
                window.voiceChat.audioContext.resume();
            }
        }
    }
});