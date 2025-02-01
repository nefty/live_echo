export function createPublisherHook(iceServers = []) {
  return {
    async mounted() {
      console.log("Echo hook mounted!");
      const view = this;

      // Initialize elements
      view.localPreview = document.getElementById("lex-local-preview");
      view.remotePreview = document.getElementById("lex-remote-preview");
      view.button = document.getElementById("lex-button");
      view.audioDevices = document.getElementById("lex-audio-devices");
      view.videoDevices = document.getElementById("lex-video-devices");

      // Audio settings
      view.echoCancellation = document.getElementById("lex-echo-cancellation");
      view.autoGainControl = document.getElementById("lex-auto-gain-control");
      view.noiseSuppression = document.getElementById("lex-noise-suppression");

      // Video settings
      view.width = document.getElementById("lex-width");
      view.height = document.getElementById("lex-height");
      view.fps = document.getElementById("lex-fps");

      // Control buttons
      view.audioApplyButton = document.getElementById("lex-audio-apply-button");
      view.videoApplyButton = document.getElementById("lex-video-apply-button");

      // Setup device change handlers
      view.audioDevices.onchange = () => view.setupStream(view);
      view.videoDevices.onchange = () => view.setupStream(view);
      view.audioApplyButton.onclick = () => view.setupStream(view);
      view.videoApplyButton.onclick = () => view.setupStream(view);

      // Initialize separate peer connections
      view.sourcePc = null;  // For sending media to server

      // Handle start/stop events
      this.handleEvent("start_stream", async () => {
        console.log("Received start_stream event from server");
        await view.startStream(view);
      });

      this.handleEvent("stop_stream", () => {
        console.log("Received stop_stream event from server");
        this.stopStream(this);
      });

      // Handle WebRTC events from server
      this.handleEvent("webrtc_event", async (msg) => {
        console.log("Received WebRTC event from server:", msg);
        
        if (msg.type === "sdp_answer") {
          try {
            await view.sourcePc.setRemoteDescription(msg.data);
            console.log("Successfully set remote description");
          } catch (error) {
            console.error("Error setting remote description:", error);
          }
        } else if (msg.type === "ice_candidate") {
          try {
            await view.sourcePc.addIceCandidate(msg.data);
            console.log("Successfully added ICE candidate");
          } catch (error) {
            console.error("Error adding ICE candidate:", error);
          }
        }
      });

      // Initialize devices and stream
      try {
        await view.findDevices(view);
        await view.setupStream(view);
        view.button.disabled = false;
        view.audioApplyButton.disabled = false;
        view.videoApplyButton.disabled = false;
      } catch (error) {
        console.error("Initial setup failed:", error);
        view.button.disabled = true;
      }
    },

    async findDevices(view) {
      console.log("findDevices called");
      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Clear existing options
      view.audioDevices.innerHTML = '';
      view.videoDevices.innerHTML = '';

      devices.forEach((device) => {
        const option = new Option(device.label || `${device.kind} (${device.deviceId})`, device.deviceId);
        if (device.kind === "videoinput") {
          view.videoDevices.add(option);
        } else if (device.kind === "audioinput") {
          view.audioDevices.add(option);
        }
      });
    },

    async setupStream(view) {
      console.log("setupStream called");
      // Get user media with current constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      // Store and display stream
      view.localStream = stream;
      view.localPreview.srcObject = stream;
      console.log("Stream setup complete:", {
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
        }))
      });
    },

    stopStream(view) {
      if (view.sourcePc) {
        view.sourcePc.close();
        view.sourcePc = null;
      }

      if (view.localStream) {
        view.localStream.getTracks().forEach((track) => track.stop());
        view.localStream = undefined;
      }
    },

    async startStream(view) {
      view.sourcePc = new RTCPeerConnection(iceServers);

      for (const track of view.localStream.getTracks()) { view.sourcePc.addTransceiver(track, { 'direction': 'sendonly' }) }

      // Handle source connection state changes
      view.sourcePc.onconnectionstatechange = () => {
        console.log("Source connection state:", view.sourcePc.connectionState);
      };

      // Handle ICE candidates for source
      view.sourcePc.onicecandidate = (ev) => {
        if (ev.candidate) {
          view.pushEvent("webrtc_event", {
            type: "ice_candidate",
            data: ev.candidate
          });
        }
      };

      // Create and send offer from source
      try {
        const offer = await view.sourcePc.createOffer();
        await view.sourcePc.setLocalDescription(offer);
        view.pushEvent("webrtc_event", {
          type: "sdp_offer",
          data: offer
        });
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    }
  };
}
