defmodule LiveEchoWeb.HomeLive do
  use LiveEchoWeb, :live_view

  require Logger

  alias LiveEcho.Pipeline
  alias Membrane.WebRTC.SignalingChannel

  def mount(_params, _session, socket) do
    Logger.info("Mounting LiveEcho")
    channel = SignalingChannel.new()
    :ok = SignalingChannel.register_peer(channel, message_format: :json_data, pid: self())
    {:ok, _sup, pid} = Pipeline.start_link(%{channel: channel})

    {:ok,
     assign(socket,
       channel: channel,
       pipeline: pid,
       streaming?: false
     )}
  end

  @impl true
  def handle_event("start_streaming", _params, socket) do
    Logger.info("Starting stream")
    {:noreply, socket |> assign(streaming?: true) |> push_event("start_streaming", %{})}
  end

  @impl true
  def handle_event("stop_streaming", _params, socket) do
    Logger.info("Stopping stream")
    {:noreply, socket |> assign(streaming?: false) |> push_event("stop_streaming", %{})}
  end

  @impl true
  def handle_event("webrtc_event", params, socket) do
    Logger.info("Received WebRTC event from client: #{inspect(params)}")

    SignalingChannel.signal(socket.assigns.channel, params)

    {:noreply, socket}
  end

  @impl true
  def handle_info(
        {Membrane.WebRTC.SignalingChannel, pid, message, _context},
        socket
      ) do
    Logger.info("Received Membrane message: #{inspect(message)}")

    {:noreply, push_event(socket, "webrtc_event", message)}
  end

  @impl true
  def terminate(reason, socket) do
    Logger.info("LiveView terminating: #{inspect(reason)}")

    if socket.assigns.pipeline do
      Membrane.Pipeline.terminate(socket.assigns.pipeline)
    end
  end

  def render(assigns) do
    ~H"""
    <div id="publisher" phx-hook="Publisher" class="h-full w-full flex justify-between gap-6">
      <div class="w-full flex flex-col">
        <details>
          <summary class="font-bold text-[#0d0d0d] py-2.5">Devices</summary>
          <div class="text-[#606060] flex flex-col gap-6 py-2.5">
            <div class="flex gap-2.5 items-center">
              <label for="lex-audio-devices" class="font-medium">Audio Device</label>
              <select
                id="lex-audio-devices"
                class="rounded-lg disabled:text-gray-400 disabled:border-gray-400 focus:border-brand focus:outline-none focus:ring-0"
              >
              </select>
            </div>
            <div class="flex gap-2.5 items-center">
              <label for="lex-video-devices" class="">Video Device</label>
              <select
                id="lex-video-devices"
                class="rounded-lg disabled:text-gray-400 disabled:border-gray-400 focus:border-brand focus:outline-none focus:ring-0"
              >
              </select>
            </div>
          </div>
        </details>

        <details>
          <summary class="font-bold text-[#0d0d0d] py-2.5">Audio Settings</summary>
          <div class="text-[#606060] flex flex-col gap-6 py-2.5">
            <div class="flex gap-2.5 items-center">
              <label for="lex-echo-cancellation">Echo Cancellation</label>
              <input type="checkbox" id="lex-echo-cancellation" class="rounded-full" checked />
            </div>
            <div class="flex gap-2.5 items-center">
              <label for="lex-auto-gain-control">Auto Gain Control</label>
              <input type="checkbox" id="lex-auto-gain-control" class="rounded-full" checked />
            </div>
            <div class="flex gap-2.5 items-center">
              <label for="lex-noise-suppression">Noise Suppression</label>
              <input type="checkbox" id="lex-noise-suppression" class="rounded-full" checked />
            </div>
          </div>
          <button
            id="lex-audio-apply-button"
            class="rounded-lg px-10 py-2.5 bg-brand disabled:bg-brand/50 hover:bg-brand/90 text-white font-bold"
            disabled
          >
            Apply
          </button>
        </details>

        <details>
          <summary class="font-bold text-[#0d0d0d] py-2.5">Video Settings</summary>
          <div class="text-[#606060] flex flex-col gap-6 py-2.5">
            <div id="lex-resolution" class="flex gap-2.5 items-center">
              <label for="lex-width">Width</label>
              <input
                type="text"
                id="lex-width"
                value="1280"
                class="rounded-lg disabled:text-gray-400 disabled:border-gray-400 focus:border-brand focus:outline-none focus:ring-0"
              />
              <label for="lex-height">Height</label>
              <input
                type="text"
                id="lex-height"
                value="720"
                class="rounded-lg disabled:text-gray-400 disabled:border-gray-400 focus:border-brand focus:outline-none focus:ring-0"
              />
            </div>
            <div class="flex gap-2.5 items-center">
              <label for="lex-fps">FPS</label>
              <input
                type="text"
                id="lex-fps"
                value="24"
                class="rounded-lg disabled:text-gray-400 disabled:border-gray-400 focus:border-brand focus:outline-none focus:ring-0"
              />
            </div>
          </div>
          <button
            id="lex-video-apply-button"
            class="rounded-lg px-10 py-2.5 bg-brand disabled:bg-brand/50 hover:bg-brand/90 text-white font-bold"
            disabled
          >
            Apply
          </button>
        </details>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="bg-black rounded-lg overflow-hidden">
            <video id="lex-local-preview" class="w-full h-full" autoplay muted></video>
          </div>
          <div class="bg-black rounded-lg overflow-hidden">
            <video id="lex-remote-preview" class="w-full h-full" autoplay></video>
          </div>
        </div>

        <div :if={@streaming?} class="py-2.5">
          <button
            id="lex-button"
            class="rounded-lg w-full px-2.5 py-2.5 bg-brand/100 disabled:bg-brand/50 hover:bg-brand/90 text-white font-bold"
            phx-click="stop_streaming"
          >
            Stop Streaming
          </button>
        </div>
        <div :if={!@streaming?} class="py-2.5">
          <button
            id="lex-button"
            class="rounded-lg w-full px-2.5 py-2.5 bg-brand/100 disabled:bg-brand/50 hover:bg-brand/90 text-white font-bold"
            phx-click="start_streaming"
          >
            Start Streaming
          </button>
        </div>
      </div>
    </div>
    """
  end
end
