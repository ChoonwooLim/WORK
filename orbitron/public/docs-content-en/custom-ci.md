# Custom CI/CD Integration (GitHub Actions, GitLab)

> 💡 **Coming Soon (Upcoming Feature)**
> 
> This is a core roadmap feature currently in intense development by the Orbitron engineering team.
> 

Going beyond the currently supported GitHub `push` event-based automatic deployments, this supports sophisticated enterprise-level pipeline integrations.

You can seamlessly combine Orbitron's ultra-fast CD (Continuous Deployment) engine with the various CI (Continuous Integration) tools you already use internally.

*   **GitHub Actions Integration**: Trigger a conditional deployment pipeline only when test code (Jest, PyTest) coverage exceeds 80%.
*   **GitLab / Bitbucket Support**: Provides dedicated Webhook Payloads for users in the ecosystem outside of GitHub.
*   **Custom API Deployment Trigger**: An authentication-based Deploy Hook API that allows you to force-replace the latest container image with just a single simple `cURL` POST request.