defmodule LiveEcho.Pipeline do
  use Membrane.Pipeline

  require Logger

  alias Membrane.WebRTC

  def start_link(options) do
    Membrane.Pipeline.start_link(__MODULE__, options)
  end

  # Callbacks

  @impl true
  def handle_init(_ctx, %{source_channel: source_channel, sink_channel: sink_channel}) do
    Logger.info("Initializing Membrane pipeline")

    spec =
      [
        child(:source, %WebRTC.Source{
          signaling: source_channel,
          allowed_video_codecs: :vp8,
          keyframe_interval: Membrane.Time.seconds(2)
        })
      ]

    {[spec: spec],
     %{
       source_channel: source_channel,
       sink_channel: sink_channel,
       audio_track: nil,
       video_track: nil
     }}
  end

  @impl true
  def handle_child_notification({:new_tracks, tracks}, :source, _ctx, state) do
    state =
      Enum.reduce(tracks, state, fn %ExWebRTC.MediaStreamTrack{} = track, acc ->
        case track.kind do
          :audio -> %{acc | audio_track: track.id}
          :video -> %{acc | video_track: track.id}
        end
      end)

    if state.audio_track && state.video_track do
      spec = [
        child(:sink, %WebRTC.Sink{
          signaling: state.sink_channel,
          video_codec: :vp8,
          tracks: [:audio, :video]
        }),
        get_child(:source)
        |> via_out(Pad.ref(:output, state.audio_track))
        |> child(:parser, %Membrane.Opus.Parser{delimitation: :undelimit})
        |> via_in(Pad.ref(:input, :audio_track), options: [kind: :audio])
        |> get_child(:sink),
        get_child(:source)
        |> via_out(Pad.ref(:output, state.video_track))
        |> via_in(Pad.ref(:input, :video_track), options: [kind: :video])
        |> get_child(:sink)
      ]

      {[spec: spec], state}
    else
      {[], state}
    end
  end

  @impl true
  def handle_child_notification({:end_of_stream, :video_track}, :sink, _ctx, state) do
    Logger.info("Pipeline: End of video stream")
    {[terminate: :normal], state}
  end

  @impl true
  def handle_child_notification({:end_of_stream, :audio_track}, :sink, _ctx, state) do
    Logger.info("Pipeline: End of audio stream")
    {[terminate: :normal], state}
  end

  @impl true
  def handle_child_notification(notification, child, _ctx, state) do
    Logger.info(
      "Unhandled child notification: #{inspect(notification)} for child: #{inspect(child)}"
    )

    {[], state}
  end

  @impl true
  def handle_terminate_request(_ctx, state) do
    Logger.info("Pipeline: Terminating")
    {[terminate: :normal], state}
  end
end
