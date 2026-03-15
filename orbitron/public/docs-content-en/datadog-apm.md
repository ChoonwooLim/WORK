# Advanced APM Monitoring Integration (Datadog, etc.)

> 💡 **Coming Soon (Upcoming Feature)**
> 
> This is a core roadmap feature currently in intense development by the Orbitron engineering team.
> 

Are you already using top-tier enterprise Application Performance Monitoring (APM) tools costing thousands of dollars at the corporate level?
Orbitron does not ignore such professional teams. Without needing to add any setup logic to the source code you wrote, we automatically inject heavyweight APM agents at the infrastructure level.

*   **Planned Supported Integrations:** Datadog, New Relic, Sentry, Prometheus/Grafana Edge
*   **Agentless-like Setup:** Simply navigate to the `Integrations` tab on the dashboard and paste the API Key and Site address for Datadog. When the code is built, the Orbitron daemon automatically links things like `dd-trace`, firing log bombs over to their site indicating exactly how many milliseconds (ms) each of your individual functions is delayed.