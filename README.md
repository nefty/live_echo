# LiveEcho

This is a Phoenix LiveView application to receive video and audio from a browser
and send it back.  It is inspired by
[echo](https://github.com/elixir-webrtc/ex_webrtc/tree/master/examples/echo), an
example from `ex_webrtc`.  Instead of using `ex_webrtc` directly, it uses
[Membrane WebRTC
plugin](https://membraneframework.org/plugins/membrane_webrtc_plugin/overview.html)
to handle the WebRTC connection.  This way, you can use a full custom pipeline
for further processing.

To start your Phoenix server:

* Run `mix setup` to install and setup dependencies
* Start Phoenix endpoint with `mix phx.server` or inside IEx with `iex -S mix phx.server`

Now you can visit [`localhost:4000`](http://localhost:4000) from your browser.

Ready to run in production? Please [check our deployment guides](https://hexdocs.pm/phoenix/deployment.html).

## Learn more

* Official website: <https://www.phoenixframework.org/>
* Guides: <https://hexdocs.pm/phoenix/overview.html>
* Docs: <https://hexdocs.pm/phoenix>
* Forum: <https://elixirforum.com/c/phoenix-forum>
* Source: <https://github.com/phoenixframework/phoenix>
