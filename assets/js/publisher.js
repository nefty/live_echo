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

      view.audioDevices.onchange = function () {
        view.setupStream(view);
      };

      view.videoDevices.onchange = function () {
        view.setupStream(view);
      };

      view.audioApplyButton.onclick = function () {
        view.setupStream(view);
      };

      view.videoApplyButton.onclick = function () {
        view.setupStream(view);
      };

      // Handle start/stop events
      this.handleEvent("start_streaming", async () => {
        console.log("Received start_streaming event from server");
        await view.startStreaming(view);
      });

      this.handleEvent("stop_streaming", () => {
        console.log("Received stop_streaming event from server");
        view.stopStreaming(view);
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

    disableControls(view) {
      view.audioDevices.disabled = true;
      view.videoDevices.disabled = true;
      view.echoCancellation.disabled = true;
      view.autoGainControl.disabled = true;
      view.noiseSuppression.disabled = true;
      view.width.disabled = true;
      view.height.disabled = true;
      view.fps.disabled = true;
      view.audioApplyButton.disabled = true;
      view.videoApplyButton.disabled = true;
    },

    enableControls(view) {
      view.audioDevices.disabled = false;
      view.videoDevices.disabled = false;
      view.echoCancellation.disabled = false;
      view.autoGainControl.disabled = false;
      view.noiseSuppression.disabled = false;
      view.width.disabled = false;
      view.height.disabled = false;
      view.fps.disabled = false;
      view.audioApplyButton.disabled = false;
      view.videoApplyButton.disabled = false;
    },

    async findDevices(view) {
      console.log("findDevices called");

      // ask for permissions
      view.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log(`Obtained stream with id: ${view.localStream.id}`);
      // Enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();

      devices.forEach((device) => {
        const option = new Option(device.label || `${device.kind} (${device.deviceId})`, device.deviceId);
        if (device.kind === "videoinput") {
          view.videoDevices.add(option);
        } else if (device.kind === "audioinput") {
          view.audioDevices.add(option);
        }
      });

      // for some reasons, firefox loses labels after closing the stream
      // so we close it after filling audio/video devices selects
      view.closeStream(view);
    },

    closeStream(view) {
      if (view.localStream != undefined) {
        console.log(`Closing stream with id: ${view.localStream.id}`);
        view.localStream.getTracks().forEach((track) => track.stop());
        view.localStream = undefined;
      }
    },

    async setupStream(view) {
      console.log("setupStream called");
      if (view.localStream != undefined) {
        view.closeStream(view);
      }

      const videoDevice = view.videoDevices.value;
      const audioDevice = view.audioDevices.value;

      console.log(
        `Setting up stream: audioDevice: ${audioDevice}, videoDevice: ${videoDevice}`
      );

      view.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: videoDevice },
          width: view.width.value,
          height: view.height.value,
          frameRate: view.fps.value,
        },
        audio: {
          deviceId: { exact: audioDevice },
          echoCancellation: view.echoCancellation.checked,
          autoGainControl: view.autoGainControl.checked,
          noiseSuppression: view.noiseSuppression.checked,
        },
      });

      console.log(`Obtained stream with id: ${view.localStream.id}`);

      view.localPreview.srcObject = view.localStream;
    },

    async startStreaming(view) {
      view.disableControls(view);

      view.sourcePc = new RTCPeerConnection(iceServers);

      // Handle source connection state changes
      view.sourcePc.onconnectionstatechange = () => {
        console.log("Source connection state:", view.sourcePc.connectionState);
        if (view.sourcePc.connectionState === "connected") {
        } else if (view.sourcePc.connectionState === "failed") {
          view.stopStreaming(view);
        }
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

      for (const track of view.localStream.getTracks()) { view.sourcePc.addTransceiver(track, { 'direction': 'sendonly' }) }

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
    },

    stopStreaming(view) {
      if (view.sourcePc) {
        view.sourcePc.close();
        view.sourcePc = undefined;
      }

      view.enableControls(view);
    },
  };
}
