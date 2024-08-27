'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    // Загружаем зашифрованный ключ из api.json
    try {
        const response = await fetch("https://yar417.github.io/test1/api.json");
        const API_DATA = await response.json();

        // Расшифровываем ключ
        const decryptedKey = decryptKey(API_DATA.key);

        if (decryptedKey === '🤫') {
            alert('Please put your API key inside ./api.json and restart..');
            return;
        }

        const RTCPeerConnection = (
          window.RTCPeerConnection ||
          window.webkitRTCPeerConnection ||
          window.mozRTCPeerConnection
        ).bind(window);

        let peerConnection;
        let pcDataChannel;
        let streamId;
        let sessionId;
        let sessionClientAnswer;

        let statsIntervalId;
        let lastBytesReceived;
        let videoIsPlaying = false;
        let streamVideoOpacity = 0;

        const stream_warmup = true;
        let isStreamReady = !stream_warmup;

        const idleVideoElement = document.getElementById('idle-video-element');
        const streamVideoElement = document.getElementById('stream-video-element');
        idleVideoElement.setAttribute('playsinline', '');
        streamVideoElement.setAttribute('playsinline', '');
        const peerStatusLabel = document.getElementById('peer-status-label');
        const iceStatusLabel = document.getElementById('ice-status-label');
        const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
        const signalingStatusLabel = document.getElementById('signaling-status-label');
        const streamingStatusLabel = document.getElementById('streaming-status-label');
        const streamEventLabel = document.getElementById('stream-event-label');

        const presenterInputByService = {
          talks: {
            source_url: 'https://i.ibb.co/fNhNZnp/005-2.jpg',
          },
          clips: {
            presenter_id: 'rian-lZC6MmWfC1',
            driver_id: 'mXra4jY38i',
          },
        };

        const connectButton = document.getElementById('connect-button');
        connectButton.onclick = async () => {
          if (peerConnection && peerConnection.connectionState === 'connected') {
            return;
          }

          stopAllStreams();
          closePC();

          const sessionResponse = await fetchWithRetries(`${API_DATA.url}/${API_DATA.service}/streams`, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${decryptedKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...presenterInputByService[API_DATA.service], stream_warmup }),
          });

          const { id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId } = await sessionResponse.json();
          streamId = newStreamId;
          sessionId = newSessionId;

          try {
            sessionClientAnswer = await createPeerConnection(offer, iceServers);
          } catch (e) {
            console.log('Error during streaming setup', e);
            stopAllStreams();
            closePC();
            return;
          }

          const sdpResponse = await fetch(`${API_DATA.url}/${API_DATA.service}/streams/${streamId}/sdp`, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${decryptedKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              answer: sessionClientAnswer,
              session_id: sessionId,
            }),
          });
        };

        const startButton = document.getElementById('start-button');
        startButton.onclick = async () => {
          if (
            (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') &&
            isStreamReady
          ) {
            const playResponse = await fetchWithRetries(`${API_DATA.url}/${API_DATA.service}/streams/${streamId}`, {
              method: 'POST',
              headers: {
                Authorization: `Basic ${decryptedKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                script: {
                  type: 'audio',
                  audio_url: 'https://www.dropbox.com/scl/fi/btdsxt0571ofgoxubhe3x/2024-08-04-14-11-22.mp3?rlkey=p3dfahymacm3unhkbi4dx124z&st=4j4tkxsd&dl=1',
                },
                ...(API_DATA.service === 'clips' && {
                  background: {
                    color: '#FFFFFF',
                  },
                }),
                config: {
                  stitch: true,
                },
                session_id: sessionId,
              }),
            });
          }
        };

        const destroyButton = document.getElementById('destroy-button');
        destroyButton.onclick = async () => {
          await fetch(`${API_DATA.url}/${API_DATA.service}/streams/${streamId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Basic ${decryptedKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ session_id: sessionId }),
          });

          stopAllStreams();
          closePC();
        };

        function onIceGatheringStateChange() {
          iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
          iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
        }
        function onIceCandidate(event) {
          console.log('onIceCandidate', event);
          if (event.candidate) {
            const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

            fetch(`${API_DATA.url}/${API_DATA.service}/streams/${streamId}/ice`, {
              method: 'POST',
              headers: {
                Authorization: `Basic ${decryptedKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                candidate,
                sdpMid,
                sdpMLineIndex,
                session_id: sessionId,
              }),
            });
          } else {
            fetch(`${API_DATA.url}/${API_DATA.service}/streams/${streamId}/ice`, {
              method: 'POST',
              headers: {
                Authorization: `Basic ${decryptedKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                session_id: sessionId,
              }),
            });
          }
        }
        function onIceConnectionStateChange() {
          iceStatusLabel.innerText = peerConnection.iceConnectionState;
          iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
          if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
            stopAllStreams();
            closePC();
          }
        }
        function onConnectionStateChange() {
          peerStatusLabel.innerText = peerConnection.connectionState;
          peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
          if (peerConnection.connectionState === 'connected') {
            playIdleVideo();
            setTimeout(() => {
              if (!isStreamReady) {
                console.log('forcing stream/ready');
                isStreamReady = true;
                streamEventLabel.innerText = 'ready';
                streamEventLabel.className = 'streamEvent-ready';
              }
            }, 5000);
          }
        }
        function onSignalingStateChange() {
          signalingStatusLabel.innerText = peerConnection.signalingState;
          signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
        }

        function onVideoStatusChange(videoIsPlaying, stream) {
          let status;

          if (videoIsPlaying) {
            status = 'streaming';
            streamVideoOpacity = isStreamReady ? 1 : 0;
            setStreamVideoElement(stream);
          } else {
            status = 'empty';
            streamVideoOpacity = 0;
          }

          streamVideoElement.style.opacity = streamVideoOpacity;
          idleVideoElement.style.opacity = 1 - streamVideoOpacity;

          streamingStatusLabel.innerText = status;
          streamingStatusLabel.className = 'streamingState-' + status;
        }

        function onTrack(event) {

          if (!event.track) return;

          statsIntervalId = setInterval(async () => {
            const stats = await peerConnection.getStats(event.track);
            stats.forEach((report) => {
              if (report.type === 'inbound-rtp' && report.kind === 'video') {
                const videoStatusChanged = videoIsPlaying !== report.bytesReceived > lastBytesReceived;

                if (videoStatusChanged) {
                  videoIsPlaying = report.bytesReceived > lastBytesReceived;
                  onVideoStatusChange(videoIsPlaying, event.streams[0]);
                }
                lastBytesReceived = report.bytesReceived;
              }
            });
          }, 500);
        }

        function onStreamEvent(message) {
          if (pcDataChannel.readyState === 'open') {
            let status;
            const [event, _] = message.data.split(':');

            switch (event) {
              case 'stream/started':
                status = 'started';
                break;
              case 'stream/done':
                status = 'done';
                break;
              case 'stream/ready':
                status = 'ready';
                break;
              case 'stream/error':
                status = 'error';
                break;
              default:
                status = 'dont-care';
            }

            if (status === 'ready') {
              setTimeout(() => {
                console.log('stream/ready');
                isStreamReady = true;
                streamEventLabel.innerText = 'ready';
                streamEventLabel.className = 'streamEvent-ready';
              }, 1000);
            } else {
              console.log(event);
              streamEventLabel.innerText = status === 'dont-care' ? event : status;
              streamEventLabel.className = 'streamEvent-' + status;
            }
          }
        }

        async function createPeerConnection(offer, iceServers) {
          if (!peerConnection) {
            peerConnection = new RTCPeerConnection({ iceServers });
            pcDataChannel = peerConnection.createDataChannel('JanusDataChannel');
            peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
            peerConnection.addEventListener('icecandidate', onIceCandidate, true);
            peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
            peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
            peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
            peerConnection.addEventListener('track', onTrack, true);
            pcDataChannel.addEventListener('message', onStreamEvent, true);
          }

          await peerConnection.setRemoteDescription(offer);
          console.log('set remote sdp OK');

          const sessionClientAnswer = await peerConnection.createAnswer();
          console.log('create local sdp OK');

          await peerConnection.setLocalDescription(sessionClientAnswer);
          console.log('set local sdp OK');

          return sessionClientAnswer;
        }

        function setStreamVideoElement(stream) {
          if (!stream) return;

          streamVideoElement.srcObject = stream;
          streamVideoElement.loop = false;
          streamVideoElement.mute = !isStreamReady;

          if (streamVideoElement.paused) {
            streamVideoElement
              .play()
              .then((_) => {})
              .catch((e) => {});
          }
        }

        function playIdleVideo() {
          idleVideoElement.src = API_DATA.service === 'clips' ? 'rian_idle.mp4' : 'or_idle.mp4';
        }

        function stopAllStreams() {
          if (streamVideoElement.srcObject) {
            console.log('stopping video streams');
            streamVideoElement.srcObject.getTracks().forEach((track) => track.stop());
            streamVideoElement.srcObject = null;
            streamVideoOpacity = 0;
          }
        }

        function closePC(pc = peerConnection) {
          if (!pc) return;
          console.log('stopping peer connection');
          pc.close();
          pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
          pc.removeEventListener('icecandidate', onIceCandidate, true);
          pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
          pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
          pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
          pc.removeEventListener('track', onTrack, true);
          pc.removeEventListener('onmessage', onStreamEvent, true);

          clearInterval(statsIntervalId);
          isStreamReady = !stream_warmup;
          streamVideoOpacity = 0;
          iceGatheringStatusLabel.innerText = '';
          signalingStatusLabel.innerText = '';
          iceStatusLabel.innerText = '';
          peerStatusLabel.innerText = '';
          streamEventLabel.innerText = '';
          console.log('stopped peer connection');
          if (pc === peerConnection) {
            peerConnection = null;
          }
        }

        const maxRetryCount = 3;
        const maxDelaySec = 4;

        async function fetchWithRetries(url, options, retries = 1) {
          try {
            return await fetch(url, options);
          } catch (err) {
            if (retries <= maxRetryCount) {
              const delay = Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) * 1000;

              await new Promise((resolve) => setTimeout(resolve, delay));

              console.log(`Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`);
              return fetchWithRetries(url, options, retries + 1);
            } else {
              throw new Error(`Max retries exceeded. error: ${err}`);
            }
          }
        }
    } catch (error) {
        console.error('Ошибка при загрузке или расшифровке API-ключа:', error);
    }

    // Функция для расшифровки ключа
    function decryptKey(encryptedKey) {
        return atob(encryptedKey); // Пример расшифровки ключа, закодированного в base64
    }

});
