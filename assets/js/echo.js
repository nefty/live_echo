export function createEchoHook(iceServers = []) {
  return {
    async mounted() {
      console.log("Echo hook mounted!");
      const view = this;

      // Initialize elements
      view.localPreview = document.getElementById("lex-local-preview");
      view.remotePlayer = document.getElementById("lex-remote-player");

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
      view.sinkPc = null;    // For receiving media from server

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

      // Handle WebRTC events from server for source connection
      this.handleEvent("source_webrtc_event", async (msg) => {
        console.log("Received source WebRTC event from server:", msg);

        if (msg.type === "sdp_answer") {
          try {
            await view.sourcePc.setRemoteDescription(msg.data);
            console.log("Successfully set source remote description");
          } catch (error) {
            console.error("Error setting source remote description:", error);
          }
        } else if (msg.type === "ice_candidate") {
          try {
            await view.sourcePc.addIceCandidate(msg.data);
            console.log("Successfully added source ICE candidate");
          } catch (error) {
            console.error("Error adding source ICE candidate:", error);
          }
        }
      });

      // Handle WebRTC events from server for sink connection
      this.handleEvent("sink_webrtc_event", async (msg) => {
        console.log("Received sink WebRTC event from server:", msg);

        if (msg.type === "sdp_offer") {
          try {
            await view.sinkPc.setRemoteDescription(msg.data);
            const answer = await view.sinkPc.createAnswer();
            await view.sinkPc.setLocalDescription(answer);
            view.pushEvent("sink_webrtc_event", {
              type: "sdp_answer",
              data: answer
            });
            console.log("Sent SDP answer:", answer)
          } catch (error) {
            console.error("Error setting sink remote description:", error);
          }
        } else if (msg.type === "ice_candidate") {
          try {
            await view.sinkPc.addIceCandidate(msg.data);
            console.log("Successfully added sink ICE candidate");
          } catch (error) {
            console.error("Error adding sink ICE candidate:", error);
          }
        }
      });

      // Initialize devices and stream
      try {
        await view.findDevices(view);
        await view.setupStream(view);
        view.enableControls(view);
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

      try {
        view.localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: videoDevice },
            width: parseInt(view.width.value),
            height: parseInt(view.height.value),
            frameRate: parseInt(view.fps.value),
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
      } catch (error) {
        console.error("Error setting up stream:", error);
        throw error;
      }
    },

    async startStreaming(view) {
      view.disableControls(view);

      view.remotePlayer.srcObject = new MediaStream();

      view.sourcePc = new RTCPeerConnection(iceServers);
      view.sinkPc = new RTCPeerConnection(iceServers);

      // Handle source connection state changes
      view.sourcePc.onconnectionstatechange = () => {
        console.log("Source connection state:", view.sourcePc.connectionState);
        if (view.sourcePc.connectionState === "failed") {
          view.stopStreaming(view);
        }
      };

      // Handle sink connection state changes
      view.sinkPc.ontrack = (ev) => view.remotePlayer.srcObject.addTrack(ev.track);

      // ICE candidate handling for source
      view.sourcePc.onicecandidate = (ev) => {
        if (ev.candidate) {
          view.pushEvent("source_webrtc_event", {
            type: "ice_candidate",
            data: ev.candidate
          });
        }
      };

      // ICE candidate handling for sink
      view.sinkPc.onicecandidate = async (ev) => {
        console.log("Recieved ICE candidate:", ev);
        await view.sinkPc.addIceCandidate(ev.data);
      };

      view.sourcePc.addTrack(view.localStream.getAudioTracks()[0], view.localStream);
      view.sourcePc.addTrack(view.localStream.getVideoTracks()[0], view.localStream);

      view.sinkPc.addTransceiver("audio", { direction: "recvonly" });
      view.sinkPc.addTransceiver("video", { direction: "recvonly" });

      // Create and send offer from source
      const sourceOffer = await view.sourcePc.createOffer();
      await view.sourcePc.setLocalDescription(sourceOffer);
      view.pushEvent("source_webrtc_event", {
        type: "sdp_offer",
        data: sourceOffer
      });
    },

    stopStreaming(view) {
      if (view.sourcePc) {
        view.sourcePc.close();
        view.sourcePc = undefined;
      }

      if (view.sinkPc) {
        view.sinkPc.close();
        view.sinkPc = undefined;
      }

      view.findDevices(view)
      view.enableControls(view);
    },
  };
}
