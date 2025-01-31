defmodule LiveEchoWeb.HomeLive do
  use LiveEchoWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, socket}
  end

  def render(assigns) do
    ~H"""
    <div>
      <h1 class="text-4xl font-bold">LiveEcho</h1>
    </div>
    """
  end
end
