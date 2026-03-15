# Private Services

This is a specialized, isolated container service that completely closes its doors to the vast ocean of the internet (WWW) and communicates exclusively within the **secure Orbitron internal network (Private Network)**.

---

## 🔒 Why deploy as Private?

Imagine your entire architecture looks like this:
1.  **Frontend (React)**: The screen users access via their phones
2.  **API Gateway (Node.js)**: The gateway where the frontend sends requests
3.  **Payment Server (Java)**: The truly core server that handles credit card secret keys and approves payments

In this case, numbers 1 and 2 must be Public web services since users need to access them, but number 3 (Payment Server) must absolutely never allow hackers to enter by typing its address from the outside.
The Payment Server must be hidden as a **Private Service** so that only number 2 (API Gateway) can call it!

---

## Setup and Calling Method (DNS Service Discovery)

Once you build a Private Service, you won't get a fancy external address like `https://myapp.twinverse.org` as you would with a regular web service. Instead, you are issued an **internal domain name managed by the Orbitron kernel (e.g., `http://payment-srv:8080`)**.

1.  From the dashboard, choose `+ New Project` > **Private Service**.
2.  Open a port normally (e.g., 8080) and boot up the server the same way.
3.  Now, when making a request from the code of another web service (API Gateway) using libraries like `axios` or `fetch`, you hardcode that internal domain into the URL field!

```javascript
// Example code for the API Gateway server (Node.js) that touches the frontend
const axios = require('axios');

app.post('/api/checkout', async (req, res) => {
    // Points to the internal network private payment server that can never be accessed from the outside!
    // You must also explicitly specify the port number (8080).
    const result = await axios.post('http://payment-srv:8080/process', req.body);
    res.json(result.data);
});
```

> 💡 **Keep in Mind (Difference from Docker Compose)**
> While using `docker-compose.yml` automatically forms an internal network because everything is handled within one file, this feature is a Clustering concept that networks services created as completely independent projects (and different repositories) to communicate with each other.
