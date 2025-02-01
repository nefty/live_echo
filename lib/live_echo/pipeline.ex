defmodule LiveEcho.Pipeline do
  use Membrane.Pipeline

  require Logger

  alias Membrane.WebRTC

  def start_link(options) do
    Membrane.Pipeline.start_link(__MODULE__, options)
  end

  # Callbacks

  @impl true
  def handle_init(_ctx, %{channel: channel}) do
    timestamp = DateTime.utc_now() |> Calendar.strftime("%Y%m%d_%H%M%S")
    spec =
      [
        child(:webrtc, %WebRTC.Source{
          signaling: channel,
          sdp_candidates_timeout: Membrane.Time.seconds(3)
        }),
        child(:matroska, Membrane.Matroska.Muxer),
        get_child(:webrtc)
        |> via_out(:output, options: [kind: :audio])
        |> child(Membrane.Opus.Parser)
        |> get_child(:matroska),
        get_child(:webrtc)
        |> via_out(:output, options: [kind: :video])
        |> get_child(:matroska),
        get_child(:matroska)
        |> child(:sink, %Membrane.File.Sink{location: "recording_#{timestamp}.mkv"})
      ]

    {[spec: spec], %{}}
  end

  @impl true
  def handle_terminate_request(_ctx, state) do
    Logger.info("Pipeline: Terminating")
    {[terminate: :normal], state}
  end

  @impl true
  def handle_element_end_of_stream(:sink, :input, _ctx, state) do
    Logger.info("Pipeline: End of stream")
    {[terminate: :normal], state}
  end

  @impl true
  def handle_element_end_of_stream(_element, _pad, _ctx, state) do
    {[], state}
  end
end
