# In-Memory Cache System (Redis)

If a Database (PostgreSQL) is a massive filing cabinet (hard disk) that permanently stores data without ever erasing it, **Redis** is an ultra-high-speed In-Memory RAM cache storage that loses everything when turned off, but boasts overwhelmingly fast processing speeds.

It is widely used not only for simple data storage but also for real-time chatting (Pub/Sub), session management, and storing heavy computational results.

---

## ⚡ Why do we need Redis?

If the server executes a complex query bringing out the "50 latest posts" from the DB every single time a user accesses the site's main page, the server will easily die.
By creating an instance of Redis with a single button in Orbitron, you can lightly store (cache) the query results in Redis when the first user enters. From the second user onward, the server doesn't hit the DB but instead **fetches the results from memory (Redis) in just 0.001 seconds**, meaning the server easily withstands a 100x traffic increase!

---

## How to Create & Connect (URL)

1. Navigate to the Database creation tab in the dashboard and select **Redis**.
2. Immediately upon creation, a unique **Redis URL (Connection String)** address like the one below drops.

```
redis://:mypassword123@redis-srv:6379/0
```

*   It uses the `redis://` protocol and contains everything: the password, hostname, and port 6379.

### Node.js (Express, etc.) Connection Example

Register the address above directly into your deploying app's environment variables as `REDIS_URL`, and then write your code.

```javascript
const redis = require('redis');

// Just insert the strange connection address string registered in your environment variables as is!
const client = redis.createClient({
    url: process.env.REDIS_URL
});

client.on('error', (err) => console.log('Redis Error:', err));

await client.connect();

// Ultra-fast cache storage and reading
await client.set('best_user', 'steven');
const name = await client.get('best_user');
```

---

## Warning Regarding Persistence (Eviction)

The fundamental design philosophy of Redis is to manage "secondary volatile (Stateless) data that, even if erased someday, will not cause fatal disruptions to the app's operation".

*   When the server memory reaches its limit (Max Memory), the Redis engine autonomously secures capacity by evicting the Least Recently Used (LRU) cached data.
*   Therefore, we strongly advise putting top-tier data that must never be erased—like financial records—strictly into PostgreSQL, and using Redis only to hold things like login sessions or temporary search results.
