# Custom CI/CD Integration (GitHub Actions, GitLab)

> 💡 **Upcoming Feature (Coming Soon)**
> 
> This feature is a core roadmap item currently under active development by the Orbitron engineering team.
> 

Beyond the currently supported GitHub `push` event-based automatic deployments, we support sophisticated enterprise-level pipeline integration.

You can seamlessly combine the various CI (Continuous Integration) tools you currently use in-house with Orbitron's ultra-fast CD (Continuous Deployment) engine.

*   **GitHub Actions Integration**: Conditional deployment pipeline trigger only when test code (Jest, PyTest) coverage exceeds 80%.
*   **GitLab / Bitbucket Support**: Provides dedicated Webhook Payloads for users outside the GitHub ecosystem.
*   **Custom API Deployment Trigger**: An authentication-based Deploy Hook API that allows you to force replace the latest container image with a single `cURL` POST request.